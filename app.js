// 1. REEMPLAZA CON TUS CREDENCIALES DE FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT.appspot.com",
    messagingSenderId: "NUMERO",
    appId: "ID_APP"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

let allMedia = [];

// DOM Elements
const grid = document.getElementById('media-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-swimmer');
const tournamentSelect = document.getElementById('filter-tournament');
const modal = document.getElementById('upload-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const formType = document.getElementById('form-type');
const imageContainer = document.getElementById('image-input-container');
const videoContainer = document.getElementById('video-input-container');
const uploadForm = document.getElementById('upload-form');
const statusMsg = document.getElementById('status-msg');
const submitBtn = document.getElementById('submit-btn');

// --- Cargar publicaciones desde Firestore ---
function loadMediaFromFirestore() {
    db.collection("publicaciones").orderBy("date", "desc")
        .onSnapshot((snapshot) => {
            allMedia = [];
            snapshot.forEach((doc) => {
                allMedia.push({ id: doc.id, ...doc.data() });
            });
            updateTournamentFilter();
            filterAndRender();
        });
}

// --- Renderizado de tarjetas ---
function renderMedia(items) {
    grid.innerHTML = '';
    if (items.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-slate-900/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl backdrop-blur-md hover:border-blue-500/50 transition';

        let mediaHTML = '';
        if (item.type === 'image') {
            mediaHTML = `<img src="${item.url}" alt="${item.title}" class="w-full h-52 object-cover" loading="lazy">`;
        } else if (item.type === 'video') {
            const embedUrl = convertToYouTubeEmbed(item.url);
            mediaHTML = `
                <div class="aspect-video w-full bg-black">
                    <iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                </div>`;
        }

        card.innerHTML = `
            ${mediaHTML}
            <div class="p-4">
                <div class="flex justify-between items-start gap-2 mb-2">
                    <h3 class="font-semibold text-lg text-slate-100">${item.title}</h3>
                    <span class="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-full uppercase">
                        ${item.type}
                    </span>
                </div>
                <p class="text-sm text-slate-300">👤 <strong>Nadador:</strong> ${item.swimmer}</p>
                <p class="text-sm text-slate-400">🏆 <strong>Torneo:</strong> ${item.tournament}</p>
                <p class="text-xs text-slate-500 mt-3">📅 ${new Date(item.date).toLocaleDateString('es-AR')}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Filtros ---
function filterAndRender() {
    const textQuery = searchInput.value.toLowerCase().trim();
    const selectedTournament = tournamentSelect.value;

    const filtered = allMedia.filter(item => {
        const matchesSwimmer = item.swimmer.toLowerCase().includes(textQuery);
        const matchesTournament = selectedTournament === '' || item.tournament === selectedTournament;
        return matchesSwimmer && matchesTournament;
    });

    renderMedia(filtered);
}

function updateTournamentFilter() {
    const tourneys = [...new Set(allMedia.map(item => item.tournament))];
    tournamentSelect.innerHTML = '<option value="">Todos los Torneos</option>';
    tourneys.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        tournamentSelect.appendChild(opt);
    });
}

// --- Transformar enlaces de YouTube normales a iframe embed ---
function convertToYouTubeEmbed(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) 
        ? `https://www.youtube.com/embed/${match[2]}` 
        : url;
}

// --- REDIMENSIONAR / COMPRIMIR IMAGEN EN NAVEGADOR ---
function compressImage(file, maxWidth = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
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

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
        };
        reader.onerror = (error) => reject(error);
    });
}

// --- EVENTOS DEL FORMULARIO Y SUBIDA ---
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50');
    statusMsg.classList.remove('hidden', 'text-red-400', 'text-green-400');
    statusMsg.classList.add('text-blue-400');
    
    const swimmer = document.getElementById('form-swimmer').value;
    const tournament = document.getElementById('form-tournament').value;
    const title = document.getElementById('form-title').value;
    const date = document.getElementById('form-date').value;
    const type = formType.value;

    let finalUrl = '';

    try {
        if (type === 'image') {
            const fileInput = document.getElementById('form-file');
            if (!fileInput.files[0]) throw new Error("Selecciona una foto.");

            statusMsg.textContent = "Comprimiendo imagen...";
            const compressedBlob = await compressImage(fileInput.files[0]);

            statusMsg.textContent = "Subiendo a Firebase Storage...";
            const storageRef = storage.ref(`fotos/${Date.now()}_${fileInput.files[0].name}`);
            const uploadTask = await storageRef.put(compressedBlob);
            finalUrl = await uploadTask.ref.getDownloadURL();

        } else if (type === 'video') {
            const youtubeUrl = document.getElementById('form-youtube-url').value;
            if (!youtubeUrl.includes('youtube') && !youtubeUrl.includes('youtu.be')) {
                throw new Error("Por favor ingresa un enlace válido de YouTube.");
            }
            finalUrl = youtubeUrl;
        }

        statusMsg.textContent = "Guardando metadatos...";
        await db.collection("publicaciones").add({
            swimmer: swimmer,
            tournament: tournament,
            title: title,
            date: date,
            type: type,
            url: finalUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        statusMsg.className = "text-xs text-center font-medium text-green-400";
        statusMsg.textContent = "¡Publicación guardada con éxito!";
        setTimeout(() => {
            uploadForm.reset();
            modal.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50');
            statusMsg.classList.add('hidden');
        }, 1500);

    } catch (err) {
        statusMsg.className = "text-xs text-center font-medium text-red-400";
        statusMsg.textContent = err.message || "Error al subir.";
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
    }
});

// UI Modal Listeners
openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

formType.addEventListener('change', (e) => {
    if (e.target.value === 'image') {
        imageContainer.classList.remove('hidden');
        videoContainer.classList.add('hidden');
    } else {
        imageContainer.classList.add('hidden');
        videoContainer.classList.remove('hidden');
    }
});

searchInput.addEventListener('input', filterAndRender);
tournamentSelect.addEventListener('change', filterAndRender);

// Inicializar
document.addEventListener('DOMContentLoaded', loadMediaFromFirestore);
