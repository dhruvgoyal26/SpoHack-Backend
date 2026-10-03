const searchInput = document.getElementById('search-input');
const searchLoader = document.getElementById('search-loader');
const searchResultsContainer = document.getElementById('search-results-container');
const searchResultsList = document.getElementById('search-results-list');
const defaultContent = document.getElementById('default-content');

const audioPlayer = document.getElementById('audio-player');
const miniPlayer = document.getElementById('mini-player');
const nowPlayingModal = document.getElementById('now-playing-modal');
const fullLoader = document.getElementById('full-loader');

const miniThumb = document.getElementById('mini-thumb');
const miniTitle = document.getElementById('mini-title');
const miniArtist = document.getElementById('mini-artist');
const miniPlayIcon = document.getElementById('mini-play-icon');
const miniProgress = document.getElementById('mini-progress');

const fullThumb = document.getElementById('full-thumb');
const fullTitle = document.getElementById('full-title');
const fullArtist = document.getElementById('full-artist');
const fullPlayIcon = document.getElementById('full-play-icon');

const scrubberTrack = document.getElementById('scrubber-track');
const scrubberProgress = document.getElementById('scrubber-progress');
const scrubberThumb = document.getElementById('scrubber-thumb');
const timeElapsed = document.getElementById('time-elapsed');
const timeTotal = document.getElementById('time-total');

let currentTrack = null;
let isModalOpen = false;

// Debounce for search
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (!q) {
        searchResultsContainer.classList.add('hidden');
        defaultContent.classList.remove('hidden');
        return;
    }

    searchTimeout = setTimeout(() => {
        performSearch(q);
    }, 300);
});

async function performSearch(q) {
    searchLoader.classList.remove('hidden');
    searchResultsContainer.classList.add('hidden');
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const results = await res.json();
        
        renderResults(results);
        
        defaultContent.classList.add('hidden');
        searchResultsContainer.classList.remove('hidden');
    } catch (e) {
        console.error("Search failed:", e);
    } finally {
        searchLoader.classList.add('hidden');
    }
}

function renderResults(results) {
    searchResultsList.innerHTML = '';
    
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-high/60 cursor-pointer active:scale-98 transition-all";
        div.onclick = () => playTrack(item);
        
        div.innerHTML = `
            <img class="w-12 h-12 rounded-lg object-cover bg-surface-container flex-shrink-0" src="${item.thumbnail}" />
            <div class="flex flex-col min-w-0 flex-1">
                <span class="font-headline-md text-body-md text-on-surface truncate">${item.title}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${item.artist}</span>
            </div>
            <span class="font-label-md text-label-md text-outline flex-shrink-0">${item.duration}</span>
        `;
        searchResultsList.appendChild(div);
    });
}

function playTrending(id, title, artist, thumbnail) {
    playTrack({ id, title, artist, thumbnail });
}

async function playTrack(item) {
    currentTrack = item;
    
    // Update UI immediately
    miniPlayer.classList.remove('translate-y-full');
    
    miniTitle.textContent = item.title;
    miniArtist.textContent = item.artist;
    miniThumb.src = item.thumbnail;
    
    fullTitle.textContent = item.title;
    fullArtist.textContent = item.artist;
    fullThumb.src = item.thumbnail;
    timeTotal.textContent = item.duration || '0:00';
    
    miniPlayIcon.textContent = 'hourglass_empty';
    fullPlayIcon.textContent = 'hourglass_empty';
    fullLoader.classList.remove('hidden');
    
    // Fetch direct stream URL
    try {
        const res = await fetch(`/api/stream/${item.id}`);
        if (!res.ok) throw new Error("Stream not found");
        const data = await res.json();
        
        audioPlayer.src = data.stream_url;
        audioPlayer.play();
        
        miniPlayIcon.textContent = 'pause';
        fullPlayIcon.textContent = 'pause';
        fullLoader.classList.add('hidden');
    } catch (e) {
        console.error("Failed to play stream:", e);
        miniPlayIcon.textContent = 'error';
        fullPlayIcon.textContent = 'error';
        fullLoader.classList.add('hidden');
    }
}

function togglePlayPause() {
    if (!audioPlayer.src) return;
    
    if (audioPlayer.paused) {
        audioPlayer.play();
        miniPlayIcon.textContent = 'pause';
        fullPlayIcon.textContent = 'pause';
    } else {
        audioPlayer.pause();
        miniPlayIcon.textContent = 'play_arrow';
        fullPlayIcon.textContent = 'play_arrow';
    }
}

function toggleFullPlayer() {
    isModalOpen = !isModalOpen;
    if (isModalOpen) {
        nowPlayingModal.classList.remove('translate-y-full');
    } else {
        nowPlayingModal.classList.add('translate-y-full');
    }
}

// Audio events and scrubber synchronization
audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    miniProgress.style.width = `${progress}%`;
    scrubberProgress.style.width = `${progress}%`;
    scrubberThumb.style.left = `${progress}%`;
    
    const currMins = Math.floor(audioPlayer.currentTime / 60);
    const currSecs = Math.floor(audioPlayer.currentTime % 60);
    timeElapsed.textContent = `${currMins}:${currSecs < 10 ? '0' : ''}${currSecs}`;
});

audioPlayer.addEventListener('ended', () => {
    miniPlayIcon.textContent = 'play_arrow';
    fullPlayIcon.textContent = 'play_arrow';
});

scrubberTrack.addEventListener('click', (e) => {
    if (!audioPlayer.duration) return;
    const rect = scrubberTrack.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioPlayer.currentTime = pos * audioPlayer.duration;
});
