#!/usr/bin/env bash

set -euo pipefail

BASE_DIR="$(pwd)/output"
OUTPUT_CSV="$(pwd)/output/hdr_info_report.csv"

echo "Scanning HDR JSON files..."

mkdir -p "$(dirname "$OUTPUT_CSV")"

# ---------------- HEADER ----------------
echo "object_id,resolution,bit_depth_status,color_primaries_status,aspect_ratio,transfer_characteristics,matrix_coefficients,color_range,mastering_display,max_cll_fall,max_luma,min_luma,video_geometry_json,metadata_json" > "$OUTPUT_CSV"

# ---------------- PROCESS FILES ----------------

for obj_dir in "$BASE_DIR"/iq__*; do
  [[ -d "$obj_dir" ]] || continue

  object_id="$(basename "$obj_dir")"

  for json in "$obj_dir"/videovideo*/hdr_result.json; do
    [[ -f "$json" ]] || continue

    resolution="$(basename "$(dirname "$json")")"

    # ---------------- QC ----------------
    bit_depth=$(jq -r '.info.bit_depth // ""' "$json")
    color_primaries=$(jq -r '.info.color_primaries // ""' "$json")

    if [[ "$bit_depth" == "10/10" ]]; then
      bit_depth_status="PASS($bit_depth)"
    else
      bit_depth_status="FAIL($bit_depth)"
    fi

    if [[ -n "$color_primaries" && "$color_primaries" != "na" ]]; then
      color_primaries_status="PASS($color_primaries)"
    else
      color_primaries_status="FAIL($color_primaries)"
    fi

    # ---------------- FLAT FIELDS ----------------
    aspect_ratio=$(jq -r '.info.aspect_ratio // ""' "$json")
    transfer=$(jq -r '.info.transfer_characteristics // ""' "$json")
    matrix=$(jq -r '.info.matrix_coefficients // ""' "$json")
    color_range=$(jq -r '.info.color_range // ""' "$json")
    mastering=$(jq -r '.info.mastering_display // ""' "$json")
    max_cll_fall=$(jq -r '.info.max_cll_fall // ""' "$json")
    max_luma=$(jq -r '.info.max_luma // ""' "$json")
    min_luma=$(jq -r '.info.min_luma // ""' "$json")

    # ---------------- JSON BLOCKS ----------------
    geometry=$(jq -c '{
      width: .info.width,
      height: .info.height,
      aspect_ratio: .info.aspect_ratio,
      sample_entry_width: .info.sample_entry_width,
      sample_entry_height: .info.sample_entry_height,
      track_width: .info.track_width,
      track_height: .info.track_height,
      sps_display_width: .info.sps_display_width,
      sps_display_height: .info.sps_display_height,
      coded_width: .info.coded_width,
      coded_height: .info.coded_height,
      conformance_window: .info.conformance_window,
      pixel_aspect_ratio: .info.pixel_aspect_ratio
    }' "$json")

    metadata=$(jq -c '{
      codec: .info.codec,
      level: .info.level,
      profile: .info.profile,
      chroma_format: .info.chroma_format,
      bit_depth: .info.bit_depth,
      transfer_characteristics: .info.transfer_characteristics,
      matrix_coefficients: .info.matrix_coefficients,
      color_range: .info.color_range,
      color_primaries: .info.color_primaries,
      mastering_display: .info.mastering_display,
      max_cll_fall: .info.max_cll_fall,
      max_luma: .info.max_luma,
      min_luma: .info.min_luma
    }' "$json")

    # ---------------- CSV ESCAPE ----------------
    escape() {
      echo "$1" | sed 's/"/""/g'
    }

    geometry=$(escape "$geometry")
    metadata=$(escape "$metadata")

    # ---------------- WRITE ROW ----------------
    echo "$object_id,$resolution,$bit_depth_status,$color_primaries_status,$aspect_ratio,$transfer,$matrix,$color_range,\"$mastering\",\"$max_cll_fall\",\"$max_luma\",\"$min_luma\",\"$geometry\",\"$metadata\"" >> "$OUTPUT_CSV"

  done
done

echo "======================================"
echo "DONE"
echo "CSV: $OUTPUT_CSV"
echo "======================================"