export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body;
    
    // Make the request to OpenRoute Service with the API key from environment variable
    const response = await fetch('https://api.openrouteservice.org/v2/isochrones/foot-walking', {
      method: 'POST',
      headers: {
        'Authorization': process.env.API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRoute Service error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in isochrones API route:', error);
    return res.status(500).json({ error: 'Failed to fetch isochrone data' });
  }
}
