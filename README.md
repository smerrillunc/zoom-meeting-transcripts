# Zoom Meeting Transcripts

Speaker-attributed transcripts of public council, board and court meetings held on
Zoom and published on YouTube. Speakers are identified from the name Zoom prints on
the active speaker's tile, and linked to the same person across all of a body's
meetings.

**Pipeline that produced it:** https://anonymous.4open.science/r/zoom-speaker-pipeline-54B8

## Data layout

```
data/collections.json              every collection: name, type, region, description,
                                   sensitivity notes, meetings, hours, speakers, dates
data/<collection>/meetings.json    its meetings: id (YouTube video id), date, title,
                                   minutes, turns, speakers, grid fraction, embeddable
data/<collection>/<video id>.json  one transcript (below)
data/<collection>/registry.json    who is who: every linked spelling of each person,
                                   the rule that linked it, and every refused link
```

A transcript is a list of turns:

```json
{"start": 3375.36, "end": 3384.72,
 "speaker": "patriciaocanaolivarez",
 "speaker_name": "Judge Patricia O'Caña-Olivarez",
 "ocr_label": "Judge Patricia O'Ca..",
 "text": "Okay. So let's come back on April the 5th at 930. And that'll be via Zoom unless he has violations."}
```

| Field | Meaning |
|---|---|
| `start`, `end` | seconds from the start of the YouTube video `https://www.youtube.com/watch?v=<video id>` |
| `speaker` | linked identity key, the same person across the collection; `Other` = no name, or a room/device/organisation tile |
| `speaker_name` | display name of that identity (`null` for `Other`) |
| `ocr_label` | the name as OCR read it during the turn, before cleaning |
| `text` | Whisper large-v2 transcription |

## Please read before use

These are public meetings that the bodies themselves recorded and published. Court
collections name private parties, including criminal defendants. Some hearings concern
family law and children, and dates of birth and phone numbers are sometimes spoken.
`data/collections.json` lists what applies to each collection. Use the data for
research, and do not use it to identify or contact private individuals. To request
removal of a meeting, contact the authors.
