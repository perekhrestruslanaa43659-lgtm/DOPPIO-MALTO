import axios from 'axios';

export default function AIAgentButton({ tableContext }) {
  const handleSendToGemini = async () => {
    try {
      const response = await axios.post('https://api.gemini.com/context', {
        context: tableContext,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        },
      });

      console.log('Response from Gemini:', response.data);
    } catch (error) {
      console.error('Error sending context to Gemini:', error);
    }
  };

  return (
    <button onClick={handleSendToGemini}>
      AI Agent
    </button>
  );
}