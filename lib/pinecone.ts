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

type PineconeToolResult =
  | { kind: 'image'; image_url: string; caption?: string; source_name?: string }
  | { kind: 'text'; text: string };

export async function searchPinecone(query: string): Promise<PineconeToolResult> {
  const results = await pineconeIndex.namespace('default').searchRecords({
    query: {
      inputs: { text: query },
      topK: PINECONE_TOP_K,
    },
    // IMPORTANT: request image_url (and whatever you used to store name/description)
    fields: [
      'text',
      'pre_context',
      'post_context',
      'source_url',
      'source_description',
      'source_type',
      'order',
      'image_url',      // <-- add this
      'image_name',     // <-- add if you stored it
      'source_name',    // <-- add if you stored it
    ],
  });

  // Helpful logs while debugging (check Vercel logs)
  const top = (results as any)?.result?.hits?.[0] ?? (results as any)?.matches?.[0];
  console.log('PINECONE TOP HIT:', top);

  // Convert to your existing chunk/source pipeline
  const chunks = searchResultsToChunks(results);
  const sources = getSourcesFromChunks(chunks);

  // Try to find an image result from sources
  const imageSource = sources.find((s: any) => s.image_url || s.source_type === 'image');

  if (imageSource?.image_url) {
    return {
      kind: 'image',
      image_url: imageSource.image_url,
      caption: imageSource.source_description || imageSource.text || '',
      source_name: imageSource.source_name || imageSource.image_name || '',
    };
  }

  // Fallback to text context
  const context = getContextFromSources(sources);
  return { kind: 'text', text: `< results > ${context} </results>` };
}
