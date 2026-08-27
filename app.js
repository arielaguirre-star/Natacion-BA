// --- CONFIGURACIÓN DE IMGBB Y FIREBASE ---
// 1. Pega aquí la API Key que obtuviste en api.imgbb.com
const IMGBB_API_KEY = "ccbc65f4bea21908a11adb119c673316";

// 2. Mantenemos Firestore (para guardar el título, fecha, nadador y el enlace de la foto)
const db = firebase.firestore();

// Elementos del DOM
const uploadForm = document.getElementById('upload-form');
const formType = document.getElementById('form-type');
const imageContainer = document.getElementById('image-input-container');
const videoContainer = document.getElementById('video-input-container');
const statusMsg = document.getElementById('status-msg');
const submitBtn = document.getElementById('submit-btn');
const modal = document.getElementById('upload-modal');

// Alternar entre foto y video en el formulario
if (formType) {
    formType.addEventListener('change', (e) => {
        if (e.target.value === 'image') {
            imageContainer.classList.remove('hidden');
            videoContainer.classList.add('hidden');
        } else {
            imageContainer.classList.add('hidden');
            videoContainer.classList.remove('hidden');
        }
    });
}

// Función auxiliar para comprimir imágenes antes de subir
function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a base64 limpio para ImgBB
                const base64String = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                resolve(base64String);
            };
        };
    });
}

// --- SUBIDA MÚLTIPLE DE FOTOS A IMGBB ---
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (IMGBB_API_KEY === "TU_API_KEY_AQUI") {
        alert("Por favor ingresa tu API Key de ImgBB en app.js");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50');
    statusMsg.classList.remove('hidden', 'text-red-400', 'text-green-400');
    statusMsg.classList.add('text-blue-400');

    const swimmer = document.getElementById('form-swimmer').value;
    const tournament = document.getElementById('form-tournament').value;
    const title = document.getElementById('form-title').value;
    const date = document.getElementById('form-date').value;
    const type = formType.value;

    try {
        if (type === 'image') {
            const fileInput = document.getElementById('form-file');
            const files = Array.from(fileInput.files);

            if (files.length === 0) {
                throw new Error("Por favor selecciona al menos una foto.");
            }

            if (files.length > 5) {
                throw new Error("Solo puedes subir hasta 5 fotos en un mismo envío.");
            }

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusMsg.textContent = `Comprimiendo foto ${i + 1} de ${files.length}...`;

                // 1. Comprimir foto
                const base64Image = await compressImage(file);

                // 2. Subir a ImgBB
                statusMsg.textContent = `Subiendo foto ${i + 1} de ${files.length} a ImgBB...`;
                
                const formData = new FormData();
                formData.append("key", IMGBB_API_KEY);
                formData.append("image", base64Image);

                const response = await fetch("https://api.imgbb.com/1/upload", {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error ? result.error.message : "Error al subir a ImgBB");
                }

                const downloadUrl = result.data.url;

                // 3. Guardar en la base de datos de Firestore
                statusMsg.textContent = `Guardando datos de foto ${i + 1}...`;
                await db.collection("publicaciones").add({
                    swimmer: swimmer,
                    tournament: tournament,
                    title: files.length > 1 ? `${title} (${i + 1}/${files.length})` : title,
                    date: date,
                    type: 'image',
                    url: downloadUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

        } else if (type === 'video') {
            const youtubeUrl = document.getElementById('form-youtube-url').value;
            if (!youtubeUrl || (!youtubeUrl.includes('youtube') && !youtubeUrl.includes('youtu.be'))) {
                throw new Error("Ingresa un enlace válido de YouTube.");
            }

            statusMsg.textContent = "Guardando video...";
            await db.collection("publicaciones").add({
                swimmer: swimmer,
                tournament: tournament,
                title: title,
                date: date,
                type: 'video',
                url: youtubeUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Éxito
        statusMsg.className = "text-xs text-center font-medium text-green-400";
        statusMsg.textContent = "¡Carga completada con éxito!";

        setTimeout(() => {
            uploadForm.reset();
            modal.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50');
            statusMsg.classList.add('hidden');
        }, 1500);

    } catch (err) {
        console.error("Error al publicar:", err);
        statusMsg.className = "text-xs text-center font-medium text-red-400";
        statusMsg.textContent = err.message || "Ocurrió un error al realizar la carga.";
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
    }
});
