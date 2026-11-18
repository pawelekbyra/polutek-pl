import { HlsWriter } from '../../../lib/modules/video-pipeline/infrastructure/r2-storage';

async function main() {
  let objectStillPresent = true;
  const client: any = {
    async send(command: any) {
      if (command.constructor.name === 'ListObjectsV2Command') return {
        Contents: [{ Key: 'videos/video-test/v/v1/seg_00001.m4s' }], IsTruncated: false
      };
      if (command.constructor.name === 'DeleteObjectsCommand') return {
        $metadata: { httpStatusCode: 200 },
        Errors: [{ Key: 'videos/video-test/v/v1/seg_00001.m4s', Code: 'AccessDenied', Message: 'simulated per-object error' }]
      };
      throw new Error('Unexpected command');
    }
  };
  const count = await new HlsWriter(client, 'fake-local-bucket').deletePrefix('videos/video-test/v/v1/');
  console.log(JSON.stringify({ scenario: 'HTTP 200 with per-object DeleteObjects error', reportedRemoved: count, objectStillPresent }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
