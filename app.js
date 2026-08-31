// --- CONFIGURACIÓN DE FIREBASE E IMGBB ---

const firebaseConfig = {
    apiKey: "AIzaSyCs6WLXvimzgnfl5OxfYoDU4EAEYxJxaOY",
    authDomain: "natacionba-3b263.firebaseapp.com",
    projectId: "natacionba-3b263",
    storageBucket: "natacionba-3b263.firebasestorage.app",
    messagingSenderId: "145111560917",
    appId: "1:145111560917:web:0598f682f78f0cfe91285c"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

const IMGBB_API_KEY = "ccbc65f4bea21908a11adb119c673316"; 

const LISTA_TORNEOS = [
    "Metro 1", "Metro 2", "Metro 3", "Metro 4", 
    "Metro 5", "Metro 6", "Metro 7", "Metro 8", 
    "Sprint primavera", "Sprint verano", "Porteño", "Nacional", "La pampa", "Internacional"
];

let currentUser = null;
let currentUserSwimmer = ""; 
let allPosts = [];

// Cargar información del perfil del usuario (Nadador vinculado)
async function fetchUserProfile(uid) {
    try {
        const userDoc = await db.collection("usuarios").doc(uid).get();
        if (userDoc.exists) {
            currentUserSwimmer = userDoc.data().swimmer || "";
        } else {
            currentUserSwimmer = "";
        }
    } catch (e) {
        console.error("Error al obtener perfil:", e);
        currentUserSwimmer = "";
    }
}
// Limpia espacios extra y convierte a formato Capitalizado correcto
function formatSwimmerName(name) {
    if (!name) return "Sin Nombre";
    return name
        .trim()
        .replace(/\s+/g, ' ') // Elimina múltiples espacios entre palabras
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
// Función auxiliar para comparar nombres sin importar mayúsculas/espacios
function cleanString(str) {
    return (str || "").toLowerCase().trim().replace(/\s+/g, ' ');
}

// --- ELIMINAR PUBLICACIÓN CON VERIFICACIÓN FLEXIBLE ---
window.deletePost = async function(postId, postSwimmer, ownerId) {
    if (!currentUser) {
        alert("Debes iniciar sesión para eliminar contenido.");
        return;
    }

    const isOwner = currentUser.uid === ownerId;
    const isSwimmerMatch = currentUserSwimmer && cleanString(currentUserSwimmer) === cleanString(postSwimmer);

    // Permite borrar si es el dueño O si la foto pertenece al nadador registrado por el usuario
    if (!isOwner && !isSwimmerMatch) {
        alert(`No tienes permiso para borrar esta foto. Tu cuenta está vinculada a "${currentUserSwimmer}" y esta foto pertenece a "${postSwimmer}".`);
        return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar esta publicación?")) {
        try {
            await db.collection("publicaciones").doc(postId).delete();
            alert("Publicación eliminada correctamente.");
            document.getElementById('swimmer-detail-modal')?.remove();
        } catch (err) {
            console.error("Error al eliminar:", err);
            alert("No fue posible eliminar este elemento: " + err.message);
        }
    }
};

function normalizeTournamentName(rawName) {
    if (!rawName) return "Torneo General";
    const cleanRaw = cleanString(rawName);
    const match = LISTA_TORNEOS.find(officialName => {
        const cleanOfficial = cleanString(officialName);
        return cleanRaw === cleanOfficial || cleanRaw.replace(/\s+/g, '') === cleanOfficial.replace(/\s+/g, '');
    });
    return match || rawName.trim();
}

function getYoutubeDetails(url) {
    let videoId = '';
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    return {
        id: videoId,
        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''
    };
}

function renderSwimmerCards(posts) {
    const mediaGrid = document.getElementById('media-grid');
    const emptyState = document.getElementById('empty-state');
    if (!mediaGrid) return;

    mediaGrid.innerHTML = '';

    if (posts.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Agrupar publicaciones por nombre formateado
    const swimmersMap = {};
    posts.forEach(post => {
        const rawName = post.swimmer || 'Sin Nombre';
        const formattedName = formatSwimmerName(rawName);
        const key = formattedName.toLowerCase(); // Clave única sin importar mayúsculas

        if (!swimmersMap[key]) {
            swimmersMap[key] = { name: formattedName, posts: [] };
        }
        swimmersMap[key].posts.push(post);
    });

    Object.values(swimmersMap).forEach(swimmer => {
        const images = swimmer.posts.filter(p => p.type === 'image');
        const videos = swimmer.posts.filter(p => p.type === 'video');
        
        let coverUrl = 'https://via.placeholder.com/400x250?text=Sin+Media';
        if (images.length > 0) coverUrl = images[0].url;
        else if (videos.length > 0) coverUrl = getYoutubeDetails(videos[0].url).thumbnail;

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
    document.getElementById('close-lightbox')?.addEventListener('click', () => document.getElementById('image-lightbox').remove());
    document.getElementById('image-lightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'image-lightbox') document.getElementById('image-lightbox').remove();
    });
}

function openSwimmerDetailModal(swimmer) {
    const oldModal = document.getElementById('swimmer-detail-modal');
    if (oldModal) oldModal.remove();

    const tournamentsMap = {};
    const videos = swimmer.posts.filter(p => p.type === 'video');

    swimmer.posts.filter(p => p.type === 'image').forEach(post => {
        const tournament = post.tournament;
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
                    ${photos.map((p) => {
                        const isOwner = currentUser && currentUser.uid === p.ownerId;
                        const isSwimmerMatch = currentUser && currentUserSwimmer && cleanString(currentUserSwimmer) === cleanString(p.swimmer);
                        const canDelete = isOwner || isSwimmerMatch;

                        const safeSwimmer = (p.swimmer || "").replace(/'/g, "\\'");

                        return `
                        <div class="group relative rounded-lg overflow-hidden bg-slate-950 aspect-square border border-slate-800">
                            <img src="${p.url}" alt="${p.title}" class="w-full h-full object-cover photo-preview cursor-pointer group-hover:scale-110 transition duration-300" data-url="${p.url}" data-title="${p.title}" data-date="${p.date}">
                            
                            ${canDelete ? `
                                <button onclick="window.deletePost('${p.id}', '${safeSwimmer}', '${p.ownerId || ''}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg text-xs z-20 shadow-lg transition" title="Eliminar foto">
                                    🗑️
                                </button>
                            ` : ''}

                            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-end text-[11px] text-white pointer-events-none">
                                <span class="font-bold truncate">${p.title}</span>
                                <span class="text-slate-300 text-[9px]">🔍 Clic para ampliar</span>
                            </div>
                        </div>
                    `}).join('')}
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
                        const isOwner = currentUser && currentUser.uid === v.ownerId;
                        const isSwimmerMatch = currentUser && currentUserSwimmer && cleanString(currentUserSwimmer) === cleanString(v.swimmer);
                        const canDelete = isOwner || isSwimmerMatch;
                        const safeSwimmer = (v.swimmer || "").replace(/'/g, "\\'");

                        return `
                            <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
                                ${canDelete ? `
                                    <button onclick="window.deletePost('${v.id}', '${safeSwimmer}', '${v.ownerId || ''}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg text-xs z-20 shadow-lg transition" title="Eliminar video">
                                        🗑️
                                    </button>
                                ` : ''}
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

    document.querySelectorAll('.photo-preview').forEach(img => {
        img.addEventListener('click', () => openImageLightbox(img.dataset.url, img.dataset.title, img.dataset.date));
    });

    document.getElementById('close-swimmer-modal')?.addEventListener('click', () => {
        document.getElementById('swimmer-detail-modal').remove();
    });
}

function applyFilters() {
    const searchSwimmer = document.getElementById('search-swimmer');
    const filterTournament = document.getElementById('filter-tournament');
    
    const swimmerQuery = searchSwimmer ? searchSwimmer.value.toLowerCase() : '';
    const tournamentQuery = filterTournament ? filterTournament.value : '';

    const filtered = allPosts.filter(post => {
        const matchesSwimmer = (post.swimmer || '').toLowerCase().includes(swimmerQuery);
        const matchesTournament = tournamentQuery === '' || post.tournament === tournamentQuery;
        return matchesSwimmer && matchesTournament;
    });

    renderSwimmerCards(filtered);
}

function updateTournamentFilter() {
    const filterTournament = document.getElementById('filter-tournament');
    if (!filterTournament) return;
    filterTournament.innerHTML = '<option value="">Todos los Torneos</option>';
    LISTA_TORNEOS.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        filterTournament.appendChild(option);
    });
}

function loadPosts() {
    updateTournamentFilter();
    db.collection("publicaciones").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        allPosts = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                tournament: normalizeTournamentName(data.tournament)
            };
        });
        applyFilters();
    }, err => console.error("Error al cargar publicaciones:", err));
}

// --- INICIALIZACIÓN Y AUTHENTICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    let isLoginMode = true;

    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const swimmerRegisterContainer = document.getElementById('swimmer-register-container');
    const authSwimmerInput = document.getElementById('auth-swimmer');

    const openLoginBtn = document.getElementById('open-login-btn');
    const openRegisterBtn = document.getElementById('open-register-btn');
    const closeAuthModalBtn = document.getElementById('close-auth-modal');
    const logoutBtn = document.getElementById('logout-btn');

    const guestControls = document.getElementById('guest-controls');
    const userControls = document.getElementById('user-controls');

    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const uploadModal = document.getElementById('upload-modal');
    const formType = document.getElementById('form-type');
    const imageContainer = document.getElementById('image-input-container');
    const videoContainer = document.getElementById('video-input-container');
    const uploadForm = document.getElementById('upload-form');

    // Estado Auth
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        const userEmailDisplay = document.getElementById('user-email-display');

        if (user) {
            await fetchUserProfile(user.uid);
            if (guestControls) guestControls.classList.add('hidden');
            if (userControls) userControls.classList.remove('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        } else {
            currentUserSwimmer = "";
            if (guestControls) guestControls.classList.remove('hidden');
            if (userControls) userControls.classList.add('hidden');
        }
        applyFilters();
    });

    openLoginBtn?.addEventListener('click', () => {
        isLoginMode = true;
        if (authModalTitle) authModalTitle.textContent = "Iniciar Sesión";
        swimmerRegisterContainer?.classList.add('hidden');
        if (authSwimmerInput) authSwimmerInput.required = false;
        authErrorMsg?.classList.add('hidden');
        authModal?.classList.remove('hidden');
    });

    openRegisterBtn?.addEventListener('click', () => {
        isLoginMode = false;
        if (authModalTitle) authModalTitle.textContent = "Crear Cuenta de Nadador";
        swimmerRegisterContainer?.classList.remove('hidden');
        if (authSwimmerInput) authSwimmerInput.required = true;
        authErrorMsg?.classList.add('hidden');
        authModal?.classList.remove('hidden');
    });

    closeAuthModalBtn?.addEventListener('click', () => authModal?.classList.add('hidden'));
    logoutBtn?.addEventListener('click', () => auth.signOut());

   // Submit Login / Registro
    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        // Dentro del registro de nuevo usuario:
const rawSwimmerName = authSwimmerInput?.value;
const swimmerName = formatSwimmerName(rawSwimmerName); // <-- Guarda el nombre limpio

        if (authErrorMsg) authErrorMsg.classList.add('hidden');

        try {
            if (isLoginMode) {
                await auth.signInWithEmailAndPassword(email, password);
                authForm.reset();
                authModal?.classList.add('hidden');
            } else {
                if (!swimmerName) throw new Error("Debes indicar el nombre del nadador.");

                // 1. Crear usuario en Firebase Auth
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Intentar guardar perfil en Firestore (si falla, atrapamos el error pero continuamos al correo)
                try {
                    await db.collection("usuarios").doc(user.uid).set({
                        email: email,
                        swimmer: swimmerName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (dbError) {
                    console.warn("No se pudo guardar la info extendida en Firestore:", dbError);
                }

                // 3. Enviar correo de verificación obligatorio
                await user.sendEmailVerification();

                // 4. Cerrar sesión automáticamente para exigir verificación/reingreso
                await auth.signOut();

                authForm.reset();
                authModal?.classList.add('hidden');

                alert(`¡Registro Exitoso!\n\nSe ha enviado un correo con el link de verificación a: ${email}\n\nPor favor, revisa tu bandeja de entrada o carpeta de SPAM, haz clic en el enlace para confirmar tu cuenta y vuelve a iniciar sesión.`);
            }
        } catch (err) {
            console.error("Error Auth:", err);
            if (authErrorMsg) {
                authErrorMsg.textContent = err.message;
                authErrorMsg.classList.remove('hidden');
            }
        }
    });

    // Modal de Carga
    openModalBtn?.addEventListener('click', () => {
        if (!currentUser) {
            alert("Debes iniciar sesión para subir fotos o videos.");
            return;
        }

        const swimmerInput = document.getElementById('form-swimmer');
        if (swimmerInput && currentUserSwimmer) {
            swimmerInput.value = currentUserSwimmer;
        }

        uploadModal?.classList.remove('hidden');
    });

    closeModalBtn?.addEventListener('click', () => uploadModal?.classList.add('hidden'));

    formType?.addEventListener('change', (e) => {
        if (e.target.value === 'image') {
            imageContainer?.classList.remove('hidden');
            videoContainer?.classList.add('hidden');
        } else {
            imageContainer?.classList.add('hidden');
            videoContainer?.classList.remove('hidden');
        }
    });

    // Submit de Cargar Contenido
    uploadForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert("Debes iniciar sesión.");
            return;
        }

        const submitBtn = document.getElementById('submit-btn');
        const statusMsg = document.getElementById('status-msg');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50');
        }
        if (statusMsg) {
            statusMsg.classList.remove('hidden', 'text-red-400', 'text-green-400');
            statusMsg.classList.add('text-blue-400');
        }

        // Dentro del submit de uploadForm:
const rawSwimmer = document.getElementById('form-swimmer').value;
const swimmer = formatSwimmerName(rawSwimmer); // <-- Se guarda formateado
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
                    if (statusMsg) statusMsg.textContent = `Subiendo foto ${i + 1} de ${files.length}...`;
                    
                    const reader = new FileReader();
                    const base64Image = await new Promise(resolve => {
                        reader.readAsDataURL(files[i]);
                        reader.onload = e => resolve(e.target.result.split(',')[1]);
                    });

                    const formData = new FormData();
                    formData.append("key", IMGBB_API_KEY);
                    formData.append("image", base64Image);

                    const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
                    const result = await res.json();
                    if (!result.success) throw new Error("Error al subir a ImgBB");

                    await db.collection("publicaciones").add({
                        swimmer, tournament,
                        title: files.length > 1 ? `${title} (${i + 1}/${files.length})` : title,
                        date, type: 'image',
                        url: result.data.url,
                        ownerId: currentUser.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else if (type === 'video') {
                const youtubeUrl = document.getElementById('form-youtube-url').value;
                await db.collection("publicaciones").add({
                    swimmer, tournament, title, date,
                    type: 'video', url: youtubeUrl,
                    ownerId: currentUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            if (statusMsg) {
                statusMsg.className = "text-xs text-center font-medium text-green-400";
                statusMsg.textContent = "¡Cargado con éxito!";
            }

            setTimeout(() => {
                uploadForm.reset();
                if (uploadModal) uploadModal.classList.add('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50');
                }
                if (statusMsg) statusMsg.classList.add('hidden');
            }, 1500);

        } catch (err) {
            if (statusMsg) {
                statusMsg.className = "text-xs text-center font-medium text-red-400";
                statusMsg.textContent = err.message || "Error al subir.";
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50');
            }
        }
    });

    document.getElementById('search-swimmer')?.addEventListener('input', applyFilters);
    document.getElementById('filter-tournament')?.addEventListener('change', applyFilters);

    loadPosts();
});
