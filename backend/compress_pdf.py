#!/usr/bin/env python3
"""
compress_pdf.py — called by server.js as a child process
Usage: python3 compress_pdf.py <input.pdf> <output.pdf> <level>
level: maximum | balanced | extreme

Exit codes:
  0 = success, prints compressed size to stdout
  1 = error, prints error message to stderr

Strategy:
  - Uses pikepdf with full stream recompression + object stream generation
  - For extreme: also strips XMP metadata, annotations, thumbnails
  - Always returns the SMALLER of (compressed, original) — never inflates
"""

import sys
import os

def compress(input_path, output_path, level="balanced"):
    try:
        import pikepdf
    except ImportError:
        sys.stderr.write("pikepdf not installed. Run: pip install pikepdf\n")
        sys.exit(1)

    original_size = os.path.getsize(input_path)

    try:
        with pikepdf.open(input_path, suppress_warnings=True) as pdf:

            # ── Strip metadata for balanced + extreme ──────────────
            if level in ("balanced", "extreme"):
                try:
                    with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
                        # Remove all XMP metadata keys
                        keys_to_remove = list(meta.keys())
                        for key in keys_to_remove:
                            try:
                                del meta[key]
                            except Exception:
                                pass
                except Exception:
                    pass

                # Clear docinfo (the /Info dictionary)
                try:
                    if pdf.docinfo:
                        for key in list(pdf.docinfo.keys()):
                            try:
                                del pdf.docinfo[key]
                            except Exception:
                                pass
                except Exception:
                    pass

            # ── Strip per-page bloat for extreme ──────────────────
            if level == "extreme":
                for page in pdf.pages:
                    try:
                        if "/Annots" in page:
                            del page["/Annots"]
                    except Exception:
                        pass
                    try:
                        if "/Thumb" in page:
                            del page["/Thumb"]
                    except Exception:
                        pass
                    try:
                        if "/PieceInfo" in page:
                            del page["/PieceInfo"]
                    except Exception:
                        pass

            # ── Save with maximum compression ─────────────────────
            # stream_decode_level=all: decode ALL streams before recompressing
            # object_stream_mode=generate: pack objects into compressed ObjStm
            # recompress_flate=True: re-deflate already-compressed streams at level 9
            pdf.save(
                output_path,
                compress_streams=True,
                stream_decode_level=pikepdf.StreamDecodeLevel.all,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                recompress_flate=True,
                normalize_content=False,  # Don't alter content streams
            )

        compressed_size = os.path.getsize(output_path)

        # Never return a larger file
        if compressed_size >= original_size:
            import shutil
            shutil.copy2(input_path, output_path)
            compressed_size = original_size

        print(compressed_size)  # stdout → read by server.js
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"pikepdf error: {str(e)}\n")
        # Fallback: copy original
        try:
            import shutil
            shutil.copy2(input_path, output_path)
            print(original_size)
            sys.exit(0)
        except Exception as e2:
            sys.stderr.write(f"Fallback copy failed: {str(e2)}\n")
            sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: python3 compress_pdf.py <input> <output> [level]\n")
        sys.exit(1)

    input_path  = sys.argv[1]
    output_path = sys.argv[2]
    level       = sys.argv[3] if len(sys.argv) > 3 else "balanced"

    compress(input_path, output_path, level)