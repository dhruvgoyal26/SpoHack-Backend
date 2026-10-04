import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import yt_dlp
import os

app = FastAPI(title="Stitch Audio Server")

# Allow CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# yt-dlp configuration for search and streaming
YTDL_OPTIONS_SEARCH = {
    'quiet': True,
    'extract_flat': True,
    'force_generic_extractor': False,
}

YTDL_OPTIONS_STREAM = {
    'quiet': True,
    'format': 'bestaudio[ext=m4a]/bestaudio/best',
    'noplaylist': True,
    'skip_download': True,
    'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
}

@app.get("/api/search")
def search_youtube(q: str):
    try:
        with yt_dlp.YoutubeDL(YTDL_OPTIONS_SEARCH) as ydl:
            if "youtube.com/" in q or "youtu.be/" in q:
                search_query = q
            else:
                search_query = f"ytsearch15:{q} audio"
                
            info = ydl.extract_info(search_query, download=False)
            
            def format_duration(duration):
                if duration:
                    m, s = divmod(duration, 60)
                    return f"{int(m)}:{int(s):02d}"
                return "0:00"

            def parse_entry(entry):
                return {
                    "id": entry.get('id'),
                    "title": entry.get('title'),
                    "artist": entry.get('uploader') or entry.get('channel') or "Unknown Artist",
                    "thumbnail": entry.get('thumbnails', [{}])[-1].get('url') if entry.get('thumbnails') else "",
                    "duration": format_duration(entry.get('duration')),
                    "duration_sec": entry.get('duration')
                }

            # yt-dlp treats search results as '_type': 'playlist' too! 
            # We must only treat it as a true playlist if the user pasted a URL
            is_url = "youtube.com/" in q or "youtu.be/" in q
            
            if is_url and (info.get('_type') == 'playlist' or 'entries' in info):
                tracks = [parse_entry(e) for e in info.get('entries', []) if e]
                return {
                    "is_playlist": True,
                    "id": info.get('id', 'playlist'),
                    "title": info.get('title', 'YouTube Playlist'),
                    "artist": info.get('uploader', 'Unknown'),
                    "tracks": tracks
                }
            else:
                # Normal search results (list of tracks)
                entries = info.get('entries', [info]) if 'entries' in info else [info]
                return [parse_entry(e) for e in entries if e]
                
    except Exception as e:
        print("Search Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream/{video_id}")
def get_stream_url(video_id: str):
    try:
        with yt_dlp.YoutubeDL(YTDL_OPTIONS_STREAM) as ydl:
            info = ydl.extract_info(video_id, download=False)
            # Find the best audio url
            stream_url = info.get('url')
            if not stream_url:
                raise HTTPException(status_code=404, detail="Stream URL not found")
            return {
                "video_id": video_id,
                "stream_url": stream_url,
                "title": info.get('title'),
                "artist": info.get('uploader'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration')
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files to serve the frontend
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>index.html not found in public/ directory</h1>")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
