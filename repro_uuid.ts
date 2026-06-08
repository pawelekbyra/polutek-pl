import { prisma } from './lib/prisma';

async function test() {
  const slug = 'some-non-uuid-slug';
  try {
    console.log('Testing findUnique with non-UUID string on id field...');
    const video = await prisma.video.findUnique({
      where: { id: slug }
    });
    console.log('Result:', video);
  } catch (e: any) {
    console.log('Caught error:', e.code, e.message);
  }

  try {
    console.log('Testing count with non-UUID string on videoId field...');
    const count = await prisma.comment.count({
      where: { videoId: slug }
    });
    console.log('Count:', count);
  } catch (e: any) {
    console.log('Caught error:', e.code, e.message);
  }
}

test();
