document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('media-grid');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-swimmer');
    const tournamentSelect = document.getElementById('filter-tournament');

    // 1. Cargar las opciones del Selector de Torneos dinámicamente
    function setupTournamentFilter() {
        const tournaments = [...new Set(mediaData.map(item => item.tournament))];
        tournaments.forEach(tournament => {
            const option = document.createElement('option');
            option.value = tournament;
            option.textContent = tournament;
            tournamentSelect.appendChild(option);
        });
    }

    // 2. Renderizar los elementos en el Grid
    function renderMedia(items) {
        grid.innerHTML = '';

        if (items.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg hover:border-blue-500/50 transition';

            let mediaHTML = '';
            if (item.type === 'image') {
                mediaHTML = `<img src="${item.url}" alt="${item.title}" class="w-full h-52 object-cover" loading="lazy">`;
            } else if (item.type === 'video') {
                mediaHTML = `
                    <div class="aspect-video w-full">
                        <iframe src="${item.url}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                    </div>`;
            }

            card.innerHTML = `
                ${mediaHTML}
                <div class="p-4">
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <h3 class="font-semibold text-lg text-slate-100">${item.title}</h3>
                        <span class="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-full whitespace-nowrap">
                            ${item.type.toUpperCase()}
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

    // 3. Lógica del Filtro Combinado
    function filterData() {
        const textQuery = searchInput.value.toLowerCase().trim();
        const selectedTournament = tournamentSelect.value;

        const filtered = mediaData.filter(item => {
            const matchesSwimmer = item.swimmer.toLowerCase().includes(textQuery);
            const matchesTournament = selectedTournament === '' || item.tournament === selectedTournament;
            return matchesSwimmer && matchesTournament;
        });

        renderMedia(filtered);
    }

    // Event Listeners
    searchInput.addEventListener('input', filterData);
    tournamentSelect.addEventListener('change', filterData);

    // Inicialización
    setupTournamentFilter();
    renderMedia(mediaData);
});
