export default async function handler(req, res) {
    // Configuración completa de cabeceras CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder a solicitudes preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { image } = req.body || {};

        if (!image) {
            return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen en la solicitud.' });                                    
        }

        const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

        if (!IMGBB_API_KEY) {
            return res.status(500).json({ success: false, error: 'Falta la API Key en las variables de entorno de Vercel.' });
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
        console.error("Error en Serverless Function:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
