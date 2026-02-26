import { Pinecone } from '@pinecone-database/pinecone';
import { PINECONE_TOP_K, PINECONE_INDEX_NAME } from '@/config';
import { searchResultsToChunks, getSourcesFromChunks, getContextFromSources } from '@/lib/sources';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set');
}

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);

export async function searchPinecone(query: string): Promise<string> {
  const results = await pineconeIndex.namespace('default').searchRecords({
    query: {
      inputs: {
        text: query,
      },
      topK: PINECONE_TOP_K,
    },
    fields: [
      'text',
      'pre_context',
      'post_context',
      'source_url',
      'source_description',
      'source_type',
      'order',
      'image_url',
    ],
  });

  const chunks = searchResultsToChunks(results);
  const sources = getSourcesFromChunks(chunks);

  let context = getContextFromSources(sources);

  const sourcesAny = sources as any[];
  const imageSource = sourcesAny.find(
    (s) => typeof s?.image_url === 'string' && s.image_url.length > 0
  );

  if (imageSource?.image_url) {
    const caption =
      imageSource.source_description ||
      imageSource.text ||
      'Image';

    context += `\n\n![${caption}](${imageSource.image_url})\n\nDirect link: ${imageSource.image_url}`;
  }

  return `< results > ${context} </results>`;
}
