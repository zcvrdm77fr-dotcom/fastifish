#!/usr/bin/env python3
import argparse, json, math, re, shutil
from collections import defaultdict
from pathlib import Path

import geopandas as gpd

RANGE_RE = re.compile(r"(-?\d+(?:[\.,]\d+)?)\s*[-–]\s*(-?\d+(?:[\.,]\d+)?)")

def parse_range(value):
    if value is None: return None
    s = str(value).strip().replace(',', '.')
    m = RANGE_RE.search(s)
    if not m: return None
    a, b = float(m.group(1)), float(m.group(2))
    if a < 0 or b < 0: return None
    return (min(a,b), max(a,b))

def depth_range_column(gdf):
    preferred = ['Syvyysvali','SYVYYSVALI','syvyysvali','DepthRange','DEPTHRANGE']
    for c in preferred:
        if c in gdf.columns: return c
    for c in gdf.columns:
        lc = c.lower()
        if 'syvyys' in lc and ('vali' in lc or 'luokka' in lc): return c
        if 'depth' in lc and ('range' in lc or 'class' in lc): return c
    return None

def classify_range(lo, hi):
    if hi <= 3.1: return 'pike_flat', 95
    if lo <= 3.1 and hi <= 6.5: return 'shallow_edge', 94
    if lo >= 3 and hi <= 7: return 'shallow_edge', 92
    if lo >= 6 and hi <= 12: return 'deep_edge', 91
    if lo >= 10: return 'deep_edge', 88
    return None, None

def tile_key(lat, lon, size=2):
    la = math.floor(lat / size) * size
    lo = math.floor(lon / size) * size
    return f"{la}_{lo}"

def rounded(v): return round(float(v), 5)

def add_spot(store, seen, lat, lon, kind, score, lo, hi, lake_name, source_id, area_m2):
    if not (59.0 <= lat <= 71.0 and 18.0 <= lon <= 33.0): return
    key = (kind, round(lat*600), round(lon*300))
    prev = seen.get(key)
    spot = {'id':f"syke-{source_id}-{len(store[tile_key(lat,lon)])}",'lat':rounded(lat),'lon':rounded(lon),'kind':kind,'score':int(score),'minDepth':round(lo,1),'maxDepth':round(hi,1)}
    if lake_name: spot['name'] = str(lake_name)[:90]
    if area_m2: spot['areaM2'] = int(min(area_m2, 2_000_000_000))
    if prev is not None:
        t, idx = prev
        if score > store[t][idx]['score']: store[t][idx] = spot
        return
    t = tile_key(lat, lon); idx = len(store[t]); store[t].append(spot); seen[key] = (t, idx)

def process_area_shapefile(shp, store, seen):
    print('Reading', shp)
    gdf = gpd.read_file(shp)
    if gdf.empty: return 0
    col = depth_range_column(gdf)
    if not col:
        print('No depth range field in', shp, list(gdf.columns)); return 0
    if gdf.crs is None:
        print('No CRS in', shp); return 0
    metric = gdf.to_crs(3067); geo = gdf.to_crs(4326)
    name_col = next((c for c in ['SyvMitta_1','JARVINIMI','JarviNimi','NIMI','NAME'] if c in gdf.columns), None)
    id_col = next((c for c in ['SyvMittaus','JarviTunnu','ID','OBJECTID'] if c in gdf.columns), None)
    added = 0
    for idx, row in geo.iterrows():
        dr = parse_range(row.get(col))
        if not dr: continue
        lo, hi = dr; kind, base_score = classify_range(lo, hi)
        if not kind: continue
        mgeom = metric.loc[idx].geometry
        if mgeom is None or mgeom.is_empty: continue
        area_m2 = float(mgeom.area)
        if area_m2 < 800: continue
        name = row.get(name_col) if name_col else None
        source_id = str(row.get(id_col) if id_col else idx).replace(' ','_')[:50]
        rp = row.geometry.representative_point(); size_bonus = 2 if 5_000 <= area_m2 <= 2_000_000 else 0
        add_spot(store, seen, rp.y, rp.x, kind, min(99, base_score+size_bonus), lo, hi, name, source_id, area_m2); added += 1
        if area_m2 >= 20_000 and kind in ('pike_flat','shallow_edge'):
            mg = mgeom.boundary; length = float(mg.length); samples = min(4, max(1, int(length // 1200) + 1))
            for n in range(samples):
                p_m = mg.interpolate(length * (n + .5) / samples)
                p = gpd.GeoSeries([p_m], crs=3067).to_crs(4326).iloc[0]
                add_spot(store, seen, p.y, p.x, kind, min(99, base_score+1), lo, hi, name, f"{source_id}-e{n}", area_m2); added += 1
    return added

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--area-dir', required=True); ap.add_argument('--output-dir', required=True); args = ap.parse_args()
    area_dir, out = Path(args.area_dir), Path(args.output_dir)
    if out.exists(): shutil.rmtree(out)
    (out/'tiles').mkdir(parents=True)
    store, seen = defaultdict(list), {}; total = 0
    for shp in sorted(area_dir.rglob('*.shp')):
        try: total += process_area_shapefile(shp, store, seen)
        except Exception as e: print('FAILED', shp, repr(e))
    count = 0
    for key, spots in sorted(store.items()):
        spots.sort(key=lambda s: (-s['score'], s['lat'], s['lon'])); spots = spots[:5000]; count += len(spots)
        (out/'tiles'/f'{key}.json').write_text(json.dumps({'spots':spots}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
    manifest = {'version':1,'source':'Suomen ympäristökeskus (Syke), CC BY 4.0','sourceUrl':'https://www.avoindata.fi/data/fi/dataset/jarvien-ja-jokien-syvyysaineisto','tileSizeDegrees':2,'tiles':sorted(store.keys()),'spotCount':count,'criteria':'SYKE lake/river depth-area classes converted to fishing structure candidates: 0-3 m pike flats, 3-6 m shallow edges and deeper basin edges.'}
    (out/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
    print(json.dumps({'rawCandidates':total,'spotCount':count,'tiles':len(store)}, ensure_ascii=False))

if __name__ == '__main__': main()
