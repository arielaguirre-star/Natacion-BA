// --- CONFIGURACIÓN DE FIREBASE E IMGBB ---

// 1. IMPORTANTE: Reemplaza este objeto con la configuración real de tu proyecto en Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCs6WLXvimzgnfl5OxfYoDU4EAEYxJxaOY",
    authDomain: "natacionba-3b263.firebaseapp.com",
    projectId: "natacionba-3b263",
    storageBucket: "natacionba-3b263.firebasestorage.app",
    messagingSenderId: "145111560917",
    appId: "1:145111560917:web:0598f682f78f0cfe91285c"
};

// Inicializar Firebase (Solo si no ha sido inicializado antes)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Inicializar únicamente Firestore
const db = firebase.firestore();

// 2. Tu API Key de ImgBB
const IMGBB_API_KEY = "ccbc65f4bea21908a11adb119c673316"; 

// --- ELEMENTOS DEL DOM ---
const mediaGrid = document.getElementById('media-grid');
const emptyState = document.getElementById('empty-state');
const searchSwimmer = document.getElementById('search-swimmer');
const filterTournament = document.getElementById('filter-tournament');
const uploadForm = document.getElementById('upload-form');
const formType = document.getElementById('form-type');
const imageContainer = document.getElementById('image-input-container');
const videoContainer = document.getElementById('video-input-container');
const statusMsg = document.getElementById('status-msg');
const submitBtn = document.getElementById('submit-btn');

// Elementos del Modal
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const modal = document.getElementById('upload-modal');

let allPosts = []; // Guardar publicaciones en memoria para filtrado rápido

// --- CONTROL DE ABRIR Y CERRAR EL FORMULARIO ---
if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

// Alternar entre Foto y Video
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

// --- RENDERIZAR PUBLICACIONES ---
function renderPosts(posts) {
    mediaGrid.innerHTML = '';

    if (posts.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = "bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md shadow-lg flex flex-col";

        let mediaHTML = '';
        if (post.type === 'image') {
            mediaHTML = `<img src="${post.url}" alt="${post.title}" class="w-full h-56 object-cover bg-slate-950" loading="lazy">`;
        } else if (post.type === 'video') {
            // Extraer ID de YouTube
            let videoId = '';
            if (post.url.includes('v=')) videoId = post.url.split('v=')[1].split('&')[0];
            else if (post.url.includes('youtu.be/')) videoId = post.url.split('youtu.be/')[1].split('?')[0];

            mediaHTML = `<iframe class="w-full h-56" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
        }

        card.innerHTML = `
            ${mediaHTML}
            <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-blue-400 font-semibold mb-1">
                        <span>🏊‍♂️ ${post.swimmer}</span>
                        <span>${post.date || ''}</span>
                    </div>
                    <h3 class="text-white font-bold text-base mb-1">${post.title}</h3>
                    <p class="text-slate-400 text-xs">🏆 ${post.tournament}</p>
                </div>
            </div>
        `;

        mediaGrid.appendChild(card);
    });
}

// --- ACTUALIZAR FILTRO DE TORNEOS ---
function updateTournamentFilter(posts) {
    const tournaments = [...new Set(posts.map(p => p.tournament).filter(Boolean))];
    filterTournament.innerHTML = '<option value="">Todos los Torneos</option>';
    tournaments.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        filterTournament.appendChild(option);
    });
}

// --- CARGAR PUBLICACIONES DESDE FIRESTORE EN TIEMPO REAL ---
function loadPosts() {
    db.collection("publicaciones").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateTournamentFilter(allPosts);
        applyFilters();
    }, err => {
        console.error("Error al cargar publicaciones:", err);
    });
}

// --- FILTRADO DE BÚSQUEDA Y SELECCIÓN ---
function applyFilters() {
    const swimmerQuery = searchSwimmer.value.toLowerCase();
    const tournamentQuery = filterTournament.value;

    const filtered = allPosts.filter(post => {
        const matchesSwimmer = (post.swimmer || '').toLowerCase().includes(swimmerQuery);
        const matchesTournament = tournamentQuery === '' || post.tournament === tournamentQuery;
        return matchesSwimmer && matchesTournament;
    });

    renderPosts(filtered);
}

searchSwimmer.addEventListener('input', applyFilters);
filterTournament.addEventListener('change', applyFilters);

// --- COMPRESIÓN DE IMÁGENES ---
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

                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
        };
    });
}

// --- ENVÍO DE FORMULARIO ---
if (uploadForm) {
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

        try {
            if (type === 'image') {
                const fileInput = document.getElementById('form-file');
                const files = Array.from(fileInput.files);

                if (files.length === 0) throw new Error("Selecciona al menos una foto.");

                for (let i = 0; i < files.length; i++) {
                    statusMsg.textContent = `Subiendo foto ${i + 1} de ${files.length}...`;
                    const base64Image = await compressImage(files[i]);

                    const formData = new FormData();
                    formData.append("key", IMGBB_API_KEY);
                    formData.append("image", base64Image);

                    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
                    const result = await res.json();

                    if (!result.success) throw new Error("Error en ImgBB");

                    await db.collection("publicaciones").add({
                        swimmer, tournament,
                        title: files.length > 1 ? `${title} (${i + 1}/${files.length})` : title,
                        date, type: 'image',
                        url: result.data.url,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else if (type === 'video') {
                const youtubeUrl = document.getElementById('form-youtube-url').value;
                await db.collection("publicaciones").add({
                    swimmer, tournament, title, date,
                    type: 'video', url: youtubeUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            statusMsg.className = "text-xs text-center font-medium text-green-400";
            statusMsg.textContent = "¡Cargado con éxito!";

            setTimeout(() => {
                uploadForm.reset();
                if (modal) modal.classList.add('hidden');
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
}

// Cargar publicaciones al iniciar la app
loadPosts();
