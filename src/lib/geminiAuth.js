import { GoogleAuth } from 'google-auth-library';

const googleCredentials = process.env.GOOGLE_CREDENTIALS_JSON;

if (!googleCredentials) {
  throw new Error('Missing GOOGLE_CREDENTIALS_JSON environment variable');
}

const auth = new GoogleAuth({
  credentials: JSON.parse(googleCredentials),
});

export async function authenticateGemini() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  return {
    model: 'gemini-1.5-flash',
    token,
  };
}