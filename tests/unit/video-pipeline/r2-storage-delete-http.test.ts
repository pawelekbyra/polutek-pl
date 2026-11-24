import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { HlsWriter, R2DeleteObjectsError } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";

describe("HlsWriter.deletePrefix over the AWS SDK HTTP protocol", () => {
  it("parses HTTP 200 per-object SlowDown and paginates without retrying confirmed keys", async () => {
    const prefix = "videos/video-1/v/v1/";
    const one = `${prefix}one.ts`;
    const two = `${prefix}two.ts`;
    const three = `${prefix}three.ts`;
    const requests: Array<{ method: string; url: string; body: string }> = [];
    let deleteAttempt = 0;
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: request.method ?? "", url: request.url ?? "", body });
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");

      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.searchParams.get("list-type") === "2") {
        if (url.searchParams.get("continuation-token") === "page-2") {
          response.end(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>hls</Name><Prefix>${prefix}</Prefix><KeyCount>1</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>${three}</Key><Size>1</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`);
          return;
        }
        response.end(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>hls</Name><Prefix>${prefix}</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>true</IsTruncated><NextContinuationToken>page-2</NextContinuationToken><Contents><Key>${one}</Key><Size>1</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>${two}</Key><Size>1</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`);
        return;
      }

      if (request.method === "POST" && url.searchParams.has("delete")) {
        deleteAttempt += 1;
        if (deleteAttempt === 1) {
          response.end(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>${one}</Key></Deleted><Error><Key>${two}</Key><Code>SlowDown</Code><Message>retry</Message></Error></DeleteResult>`);
          return;
        }
        if (deleteAttempt === 2) {
          response.end(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>${two}</Key></Deleted></DeleteResult>`);
          return;
        }
        response.end(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>${three}</Key></Deleted></DeleteResult>`);
        return;
      }

      response.statusCode = 400;
      response.end("<Error><Code>InvalidRequest</Code></Error>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const client = new S3Client({
      region: "auto",
      endpoint: `http://127.0.0.1:${port}`,
      forcePathStyle: true,
      credentials: { accessKeyId: "loopback-only", secretAccessKey: "loopback-only" },
      maxAttempts: 1,
    });

    try {
      await expect(new HlsWriter(client, "hls").deletePrefix(prefix)).resolves.toBe(3);
      const listRequests = requests.filter(({ method, url }) => method === "GET" && url.includes("list-type=2"));
      const deleteRequests = requests.filter(({ method, url }) => method === "POST" && url.includes("delete"));
      expect(listRequests).toHaveLength(2);
      expect(new URL(listRequests[1]!.url, "http://127.0.0.1").searchParams.get("continuation-token")).toBe("page-2");
      expect(deleteRequests).toHaveLength(3);
      expect(deleteRequests[0]!.body).toContain(`<Key>${one}</Key>`);
      expect(deleteRequests[0]!.body).toContain(`<Key>${two}</Key>`);
      expect(deleteRequests[1]!.body).toContain(`<Key>${two}</Key>`);
      expect(deleteRequests[1]!.body).not.toContain(`<Key>${one}</Key>`);
      expect(deleteRequests[2]!.body).toContain(`<Key>${three}</Key>`);
    } finally {
      client.destroy();
      server.close();
      await once(server, "close");
    }
  });

  it("surfaces HTTP 200 AccessDenied and confirms only the successful key", async () => {
    const prefix = "videos/video-1/v/v1/";
    const one = `${prefix}one.ts`;
    const two = `${prefix}two.ts`;
    const server = createServer(async (request, response) => {
      for await (const _chunk of request) { /* consume the request body */ }
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.searchParams.get("list-type") === "2") {
        response.end(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>hls</Name><Prefix>${prefix}</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>${one}</Key><Size>1</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>${two}</Key><Size>1</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`);
        return;
      }
      if (request.method === "POST" && url.searchParams.has("delete")) {
        response.end(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>${one}</Key></Deleted><Error><Key>${two}</Key><Code>AccessDenied</Code><Message>denied</Message></Error></DeleteResult>`);
        return;
      }
      response.statusCode = 400;
      response.end("<Error><Code>InvalidRequest</Code></Error>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const client = new S3Client({ region: "auto", endpoint: `http://127.0.0.1:${port}`, forcePathStyle: true,
      credentials: { accessKeyId: "loopback-only", secretAccessKey: "loopback-only" }, maxAttempts: 1 });

    try {
      const failure = await new HlsWriter(client, "hls").deletePrefix(prefix).then(() => null, (error: unknown) => error);
      expect(failure).toBeInstanceOf(R2DeleteObjectsError);
      expect(failure).toMatchObject({ failedCount: 1, removedCount: 1, errorCodes: ["AccessDenied"] });
    } finally {
      client.destroy();
      server.close();
      await once(server, "close");
    }
  });
});
