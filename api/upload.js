export default async function handler(req, res) {
    // Permitir solicitudes CORS para que tu web en GitHub Pages pueda conectarse
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido' });
    }

    try {
        const { image } = req.body;
        
        // Obtiene la API Key desde la variable de entorno oculta de Vercel
        const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

        if (!IMGBB_API_KEY) {
            return res.status(500).json({ error: 'Falta la API Key en el servidor.' });
        }

        const formData = new URLSearchParams();
        formData.append("key", IMGBB_API_KEY);
        formData.append("image", image);

        const response = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
