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



const LISTA_TORNEOS = [
    "Metro 1", "Metro 2", "Metro 3", "Metro 4", 
    "Metro 5", "Metro 6", "Metro 7", "Metro 8", 
    "Sprint primavera", "Sprint verano", "Porteño", "Nacional", "La pampa", "Internacional"
];

let currentUser = null;
let currentUserSwimmer = ""; 
let allPosts = [];

// Formatear y estandarizar nombres de nadadores
function formatSwimmerName(name) {
    if (!name) return "Sin Nombre";
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

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

function cleanString(str) {
    return (str || "").toLowerCase().trim().replace(/\s+/g, ' ');
}

// --- ELIMINAR PUBLICACIÓN ---
window.deletePost = async function(postId, postSwimmer, ownerId) {
    if (!currentUser) {
        alert("Debes iniciar sesión para eliminar contenido.");
        return;
    }

    const isOwner = currentUser.uid === ownerId;
    const isSwimmerMatch = currentUserSwimmer && cleanString(currentUserSwimmer) === cleanString(postSwimmer);

    if (!isOwner && !isSwimmerMatch) {
        alert(`No tienes permiso para borrar esta foto. Tu cuenta está vinculada a "${currentUserSwimmer}" y esta foto pertenece a "${postSwimmer}".`);
        return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar este contenido?")) {
        try {
            await db.collection("publicaciones").doc(postId).delete();
            alert("Eliminado correctamente.");
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

    const swimmersMap = {};
    posts.forEach(post => {
        const rawName = post.swimmer || 'Sin Nombre';
        const formattedName = formatSwimmerName(rawName);
        const key = formattedName.toLowerCase();

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

function openImageLightbox(url) {
    const oldLightbox = document.getElementById('image-lightbox');
    if (oldLightbox) oldLightbox.remove();

    const lightboxHTML = `
        <div id="image-lightbox" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4">
            <button id="close-lightbox" class="absolute top-4 right-6 text-white text-3xl font-bold hover:text-blue-400 transition cursor-pointer">✕</button>
            <div class="max-w-4xl max-h-[85vh] flex flex-col items-center">
                <img src="${url}" class="max-w-full max-h-[80vh] object-contain rounded-lg border border-slate-800 shadow-2xl">
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
                            <img src="${p.url}" class="w-full h-full object-cover photo-preview cursor-pointer group-hover:scale-110 transition duration-300" data-url="${p.url}">
                            
                            ${canDelete ? `
                                <button onclick="window.deletePost('${p.id}', '${safeSwimmer}', '${p.ownerId || ''}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg text-xs z-20 shadow-lg transition" title="Eliminar foto">
                                    🗑️
                                </button>
                            ` : ''}

                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-end text-[11px] text-white pointer-events-none">
                                <span class="text-slate-300 text-[10px]">🔍 Clic para ampliar</span>
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
        img.addEventListener('click', () => openImageLightbox(img.dataset.url));
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

// --- INICIALIZACIÓN Y AUTENTICACIÓN ---
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
        const userEmailDisplay = document.getElementById('user-email-display');

        if (user && !user.emailVerified && user.providerData[0]?.providerId === 'password') {
            currentUser = null;
            currentUserSwimmer = "";
            await auth.signOut();
            if (guestControls) guestControls.classList.remove('hidden');
            if (userControls) userControls.classList.add('hidden');
            applyFilters();
            return;
        }

        currentUser = user;

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

    // Submit Login / Registro Tradicional
    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const rawSwimmerName = authSwimmerInput?.value;
        const swimmerName = formatSwimmerName(rawSwimmerName);

        if (authErrorMsg) authErrorMsg.classList.add('hidden');

        try {
            if (isLoginMode) {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                if (!user.emailVerified) {
                    await auth.signOut();
                    const resend = confirm(
                        "⚠️ Tu cuenta aún no está verificada.\n\n" +
                        "Debes hacer clic en el enlace enviado a " + email + " para ingresar.\n\n" +
                        "¿Deseas reenviar el correo de verificación?"
                    );

                    if (resend) {
                        await user.sendEmailVerification();
                        alert("Correo reenviado. Revisa tu bandeja de entrada o SPAM.");
                    }
                    return;
                }

                authForm.reset();
                authModal?.classList.add('hidden');

            } else {
                if (!swimmerName) throw new Error("Debes indicar el nombre del nadador.");

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                try {
                    await db.collection("usuarios").doc(user.uid).set({
                        email: email,
                        swimmer: swimmerName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (dbError) {
                    console.warn("Error en Firestore:", dbError);
                }

                await user.sendEmailVerification();
                await auth.signOut();

                authForm.reset();
                authModal?.classList.add('hidden');

                alert(`¡Registro Exitoso!\n\nSe ha enviado un correo de activación a ${email}.\nConfirma tu correo para poder ingresar.`);
            }
        } catch (err) {
            console.error("Error Auth:", err);
            if (authErrorMsg) {
                authErrorMsg.textContent = err.message;
                authErrorMsg.classList.remove('hidden');
            }
        }
    });

    // Login con Google
    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSwimmerModal = document.getElementById('google-swimmer-modal');
    const googleSwimmerForm = document.getElementById('google-swimmer-form');
    const googleSwimmerInput = document.getElementById('google-swimmer-input');
    let pendingGoogleUser = null;

    googleLoginBtn?.addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            const userDoc = await db.collection("usuarios").doc(user.uid).get();

            if (!userDoc.exists || !userDoc.data().swimmer) {
                pendingGoogleUser = user;
                authModal?.classList.add('hidden');
                googleSwimmerModal?.classList.remove('hidden');
            } else {
                authModal?.classList.add('hidden');
                await fetchUserProfile(user.uid);
                applyFilters();
            }
        } catch (error) {
            console.error("Error Google Auth:", error);
            if (authErrorMsg) {
                authErrorMsg.textContent = error.message;
                authErrorMsg.classList.remove('hidden');
            }
        }
    });

    googleSwimmerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const swimmerName = formatSwimmerName(googleSwimmerInput.value);

        if (!swimmerName || !pendingGoogleUser) return;

        try {
            await db.collection("usuarios").doc(pendingGoogleUser.uid).set({
                email: pendingGoogleUser.email,
                swimmer: swimmerName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            currentUserSwimmer = swimmerName;
            googleSwimmerModal?.classList.add('hidden');
            googleSwimmerForm.reset();
            pendingGoogleUser = null;

            applyFilters();
            alert("¡Perfil guardado correctamente!");
        } catch (error) {
            console.error("Error al guardar perfil de Google:", error);
            alert("Error al guardar perfil: " + error.message);
        }
    });

    // Modal de Carga de Contenido
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

        const swimmer = formatSwimmerName(document.getElementById('form-swimmer').value);
        const tournament = document.getElementById('form-tournament').value;
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
                    // ANTES (Directo a ImgBB):
                    //const formData = new FormData();
                    //formData.append("key", IMGBB_API_KEY);
                    //formData.append("image", base64Image);

                    //const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
                    // AHORA (A través de tu servidor seguro en Vercel):
const res = await fetch("https://vercel.com/etiqueta-negra/natacion-ba/9t17zjJ1LRgy2V2r2gXxcwbxeBd2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image })
});

const result = await res.json();
if (!result.success) throw new Error("Error al subir la imagen");
                   

                    await db.collection("publicaciones").add({
                        swimmer, 
                        tournament,
                        type: 'image',
                        url: result.data.url,
                        ownerId: currentUser.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else if (type === 'video') {
                const youtubeUrl = document.getElementById('form-youtube-url').value;
                await db.collection("publicaciones").add({
                    swimmer, 
                    tournament, 
                    type: 'video', 
                    url: youtubeUrl,
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
