# verifica_strip_specifica.py
from database import DatabaseManager

def verifica_compatibilita_strip(strip_pattern="ZIGZAG"):
    db = DatabaseManager()
    
    print(f"=== VERIFICA COMPATIBILITÀ PER STRIP CONTENENTI '{strip_pattern}' ===")
    
    # 1. Trova strip che contengono il pattern
    strips = db.supabase.table('strip_led')\
        .select('id, nome_commerciale, tensione, ip')\
        .or_(f'id.ilike.%{strip_pattern}%,nome_commerciale.ilike.%{strip_pattern}%')\
        .execute().data
    
    print(f"Strip trovate con pattern '{strip_pattern}': {len(strips)}")
    for strip in strips:
        print(f"  - {strip['id']}: {strip.get('nome_commerciale', 'N/A')} ({strip['tensione']}, {strip['ip']})")
    
    # 2. Per ogni strip, trova i profili compatibili
    for strip in strips:
        strip_id = strip['id']
        print(f"\n--- Profili compatibili con {strip_id} ---")
        
        compatibilita = db.supabase.table('profili_strip_compatibili')\
            .select('profilo_id')\
            .eq('strip_id', strip_id)\
            .execute().data
        
        print(f"Profili compatibili: {len(compatibilita)}")
        
        if compatibilita:
            profilo_ids = [c['profilo_id'] for c in compatibilita]
            profili = db.supabase.table('profili')\
                .select('id, nome, categoria')\
                .in_('id', profilo_ids)\
                .execute().data
            
            for profilo in profili[:5]:  # Mostra primi 5
                print(f"  ✅ {profilo['id']}: {profilo['nome']} ({profilo['categoria']})")
            
            if len(profili) > 5:
                print(f"  ... e altri {len(profili) - 5} profili")
        else:
            print("  ❌ Nessun profilo compatibile trovato!")
    
    # 3. Verifica specificamente per categoria esterni
    print(f"\n--- Profili ESTERNI compatibili con strip ZIGZAG ---")
    profili_esterni = db.supabase.table('profili')\
        .select('id, nome')\
        .eq('categoria', 'esterni')\
        .execute().data
    
    print(f"Profili esterni totali: {len(profili_esterni)}")
    
    compatibili_esterni = []
    for profilo in profili_esterni:
        compatibilita = db.supabase.table('profili_strip_compatibili')\
            .select('strip_id')\
            .eq('profilo_id', profilo['id'])\
            .execute().data
        
        strip_ids = [c['strip_id'] for c in compatibilita]
        ha_zigzag = any('ZIGZAG' in sid for sid in strip_ids)
        
        if ha_zigzag:
            compatibili_esterni.append(profilo)
            zigzag_strips = [sid for sid in strip_ids if 'ZIGZAG' in sid]
            print(f"  ✅ {profilo['id']}: {profilo['nome']} -> {zigzag_strips}")
    
    print(f"\nProfili esterni con strip ZIGZAG: {len(compatibili_esterni)}")

def verifica_strip_temperature_potenze(strip_id):
    db = DatabaseManager()
    
    print(f"\n=== DETTAGLI PER STRIP {strip_id} ===")
    
    # Verifica se la strip esiste
    strip = db.supabase.table('strip_led')\
        .select('*')\
        .eq('id', strip_id)\
        .execute().data
    
    if not strip:
        print(f"❌ Strip {strip_id} non trovata!")
        return
    
    strip = strip[0]
    print(f"Strip trovata: {strip.get('nome_commerciale', 'N/A')}")
    print(f"Tensione: {strip['tensione']}, IP: {strip['ip']}")
    
    # Temperature
    temperature = db.supabase.table('strip_temperature')\
        .select('temperatura')\
        .eq('strip_id', strip_id)\
        .execute().data
    
    print(f"Temperature disponibili: {[t['temperatura'] for t in temperature]}")
    
    # Potenze
    potenze = db.supabase.table('strip_potenze')\
        .select('potenza, codice_prodotto')\
        .eq('strip_id', strip_id)\
        .execute().data
    
    print(f"Potenze disponibili: {[p['potenza'] for p in potenze]}")

if __name__ == "__main__":
    verifica_compatibilita_strip("ZIGZAG")
    
    # Verifica anche le strip specifiche che appaiono nel log
    strip_da_verificare = [
        "STRIP_24V_ZIGZAG_IP66",
        "STRIP_48V_ZIGZAG_IP66"
    ]
    
    for strip_id in strip_da_verificare:
        verifica_strip_temperature_potenze(strip_id)