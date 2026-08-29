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

// LISTA FIJA DE TORNEOS PERMITIDOS
const LISTA_TORNEOS = [
    "Metro 1", "Metro 2", "Metro 3", "Metro 4", 
    "Metro 5", "Metro 6", "Metro 7", "Metro 8", 
    "Sprint primavera", "Sprint verano", "Porteño", "Nacional", "La pampa"
];
// --- NORMALIZADOR DE TORNEOS VIEJOS Y NUEVOS ---
function normalizeTournamentName(rawName) {
    if (!rawName) return "Torneo General";
    
    // Limpieza de texto (quitar espacios de más y pasar a minúsculas para comparar)
    const cleanRaw = rawName.toString().trim().toLowerCase().replace(/\s+/g, ' ');

    // Buscar coincidencia exacta o aproximada en la lista oficial
    const match = LISTA_TORNEOS.find(officialName => {
        const cleanOfficial = officialName.toLowerCase();
        return cleanRaw === cleanOfficial || cleanRaw.replace(/\s+/g, '') === cleanOfficial.replace(/\s+/g, '');
    });

    // Si coincide con alguno oficial lo devuelve estandarizado, si no, mantiene el nombre original limpio
    return match || rawName.trim();
}
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

const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const modal = document.getElementById('upload-modal');

let allPosts = []; 

// --- CONTROL DE MODAL DE CARGA ---
if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

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

// --- EXTRAER ID Y MINIATURA DE YOUTUBE ---
function getYoutubeDetails(url) {
    let videoId = '';
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    return {
        id: videoId,
        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''
    };
}

// --- RENDERIZAR CARTAS POR NADADOR ---
function renderSwimmerCards(posts) {
    mediaGrid.innerHTML = '';

    if (posts.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    const swimmersMap = {};

    posts.forEach(post => {
        const name = post.swimmer || 'Sin Nombre';
        if (!swimmersMap[name]) {
            swimmersMap[name] = { name: name, posts: [] };
        }
        swimmersMap[name].posts.push(post);
    });

    Object.values(swimmersMap).forEach(swimmer => {
        const images = swimmer.posts.filter(p => p.type === 'image');
        const videos = swimmer.posts.filter(p => p.type === 'video');
        
        let coverUrl = 'https://via.placeholder.com/400x250?text=Sin+Media';
        if (images.length > 0) {
            coverUrl = images[0].url;
        } else if (videos.length > 0) {
            coverUrl = getYoutubeDetails(videos[0].url).thumbnail;
        }

        const card = document.createElement('div');
        card.className = "bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl flex flex-col hover:border-blue-500/50 transition duration-300 cursor-pointer group";
        
        card.innerHTML = `
            <div class="relative h-48 overflow-hidden bg-slate-950">
                <img src="${coverUrl}" alt="${swimmer.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                <div class="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                    <span class="bg-blue-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        🏊‍♂️ Nadador
                    </span>
                </div>
            </div>
            <div class="p-5 flex-1 flex flex-col justify-between">
                <div>
                    <h3 class="text-xl font-bold text-white group-hover:text-blue-400 transition mb-2">${swimmer.name}</h3>
                    <div class="flex items-center gap-4 text-xs text-slate-400">
                        <span>📸 ${images.length} fotos</span>
                        <span>🎥 ${videos.length} videos</span>
                    </div>
                </div>
                <button class="mt-4 w-full bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-semibold py-2 px-4 rounded-xl text-xs transition">
                    Ver perfil y galería
                </button>
            </div>
        `;

        card.addEventListener('click', () => openSwimmerDetailModal(swimmer));
        mediaGrid.appendChild(card);
    });
}

// --- VISOR DE IMAGEN AMPLIADA (LIGHTBOX) ---
function openImageLightbox(url, title, date) {
    const oldLightbox = document.getElementById('image-lightbox');
    if (oldLightbox) oldLightbox.remove();

    const lightboxHTML = `
        <div id="image-lightbox" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4">
            <button id="close-lightbox" class="absolute top-4 right-6 text-white text-3xl font-bold hover:text-blue-400 transition cursor-pointer">✕</button>
            <div class="max-w-4xl max-h-[80vh] flex flex-col items-center">
                <img src="${url}" alt="${title}" class="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-800 shadow-2xl">
                <div class="text-center mt-3">
                    <h4 class="text-white text-base font-bold">${title}</h4>
                    <p class="text-slate-400 text-xs">${date || ''}</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', lightboxHTML);

    document.getElementById('close-lightbox').addEventListener('click', () => {
        document.getElementById('image-lightbox').remove();
    });

    document.getElementById('image-lightbox').addEventListener('click', (e) => {
        if (e.target.id === 'image-lightbox') {
            document.getElementById('image-lightbox').remove();
        }
    });
}

// --- MODAL DETALLE DEL NADADOR ---
function openSwimmerDetailModal(swimmer) {
    const oldModal = document.getElementById('swimmer-detail-modal');
    if (oldModal) oldModal.remove();

    const tournamentsMap = {};
    const videos = swimmer.posts.filter(p => p.type === 'video');

    swimmer.posts.filter(p => p.type === 'image').forEach(post => {
        const tournament = post.tournament || 'Torneo General';
        if (!tournamentsMap[tournament]) tournamentsMap[tournament] = [];
        tournamentsMap[tournament].push(post);
    });

    let tournamentsHTML = '';
    Object.keys(tournamentsMap).forEach(tournament => {
        const photos = tournamentsMap[tournament];
        tournamentsHTML += `
            <div class="mb-6">
                <h4 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    🏆 ${tournament}
                </h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${photos.map((p, index) => `
                        <div data-photo-index="${index}" data-tournament="${tournament}" class="photo-item group relative rounded-lg overflow-hidden bg-slate-950 aspect-square border border-slate-800 cursor-pointer">
                            <img src="${p.url}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300">
                            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-end text-[11px] text-white">
                                <span class="font-bold truncate">${p.title}</span>
                                <span class="text-slate-300 text-[9px]">🔍 Clic para ampliar</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    let videosHTML = '';
    if (videos.length > 0) {
        videosHTML = `
            <div class="mt-8 border-t border-slate-800 pt-6">
                <h4 class="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    🎥 Videos de YouTube
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${videos.map(v => {
                        const yt = getYoutubeDetails(v.url);
                        return `
                            <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                                <iframe class="w-full h-40" src="https://www.youtube.com/embed/${yt.id}" frameborder="0" allowfullscreen></iframe>
                                <div class="p-3">
                                    <h5 class="text-xs font-bold text-white truncate">${v.title}</h5>
                                    <p class="text-[10px] text-slate-400">🏆 ${v.tournament}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const modalHTML = `
        <div id="swimmer-detail-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl">
                <button id="close-swimmer-modal" class="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">✕</button>
                
                <div class="border-b border-slate-800 pb-4 mb-6">
                    <h2 class="text-2xl font-black text-white">🏊‍♂️ ${swimmer.name}</h2>
                    <p class="text-xs text-slate-400">Haz clic en cualquier foto para verla en tamaño completo</p>
                </div>

                ${tournamentsHTML || '<p class="text-xs text-slate-500">No hay fotos registradas para este nadador.</p>'}
                ${videosHTML}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.querySelectorAll('.photo-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const tName = item.getAttribute('data-tournament');
            const idx = parseInt(item.getAttribute('data-photo-index'));
            const photoData = tournamentsMap[tName][idx];
            openImageLightbox(photoData.url, photoData.title, photoData.date);
        });
    });

    document.getElementById('close-swimmer-modal').addEventListener('click', () => {
        document.getElementById('swimmer-detail-modal').remove();
    });
}

// --- ACTUALIZAR FILTRO DE TORNEOS ---
function updateTournamentFilter() {
    filterTournament.innerHTML = '<option value="">Todos los Torneos</option>';
    LISTA_TORNEOS.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        filterTournament.appendChild(option);
    });
}

// --- CARGAR PUBLICACIONES EN TIEMPO REAL ---
function loadPosts() {
    updateTournamentFilter();
    db.collection("publicaciones").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyFilters();
    }, err => {
        console.error("Error al cargar publicaciones:", err);
    });
}

// --- FILTRADO DE BÚSQUEDA ---
function applyFilters() {
    const swimmerQuery = searchSwimmer.value.toLowerCase();
    const tournamentQuery = filterTournament.value;

    const filtered = allPosts.filter(post => {
        const matchesSwimmer = (post.swimmer || '').toLowerCase().includes(swimmerQuery);
        const matchesTournament = tournamentQuery === '' || post.tournament === tournamentQuery;
        return matchesSwimmer && matchesTournament;
    });

    renderSwimmerCards(filtered);
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

        if (!tournament) {
            alert("Por favor selecciona un torneo de la lista.");
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50');
            return;
        }

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

// Iniciar aplicación
loadPosts();
