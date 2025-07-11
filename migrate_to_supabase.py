import json
import os
from supabase import create_client, Client

# SOSTITUISCI CON LE TUE CREDENZIALI
SUPABASE_URL = "https://ttwdtmmskgwwskkzgdno.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d2R0bW1za2d3d3Nra3pnZG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNTY0MDksImV4cCI6MjA2NzgzMjQwOX0.sQZMhePG-LBV8sLckhL0G1QUBRRN40HohBYOY7EwtWk"  # Sostituisci con la tua anon key

# Percorso del file JSON
JSON_FILE_PATH = "static/data/configurazioni.json"

def main():
    print("🚀 Inizio migrazione dati verso Supabase...")
    
    # Inizializza client Supabase
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connessione a Supabase stabilita")
    except Exception as e:
        print(f"❌ Errore connessione Supabase: {e}")
        return
    
    # Carica dati JSON
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ File JSON caricato: {JSON_FILE_PATH}")
    except Exception as e:
        print(f"❌ Errore caricamento JSON: {e}")
        return
    
    # STEP 1: Migra Categorie
    print("\n📁 Migrazione CATEGORIE...")
    categorie_migrate = 0
    
    for categoria in data.get('categoriePrincipali', []):
        try:
            # Inserisci categoria
            result = supabase.table('categorie').insert({
                'id': categoria['id'],
                'nome': categoria['nome'],
                'immagine': categoria.get('immagine')
            }).execute()
            
            # Inserisci sottofamiglie
            for sottofamiglia in categoria.get('sottofamiglie', []):
                supabase.table('categorie_sottofamiglie').insert({
                    'categoria_id': categoria['id'],
                    'sottofamiglia': sottofamiglia
                }).execute()
            
            categorie_migrate += 1
            print(f"  ✓ {categoria['nome']}")
            
        except Exception as e:
            print(f"  ✗ Errore con {categoria['id']}: {e}")
    
    print(f"✅ Migrate {categorie_migrate} categorie")
    
    # STEP 2: Migra Strip LED
    print("\n💡 Migrazione STRIP LED...")
    strip_migrate = 0
    
    for strip_id, strip_info in data.get('stripLed', {}).items():
        try:
            # Inserisci strip principale
            result = supabase.table('strip_led').insert({
                'id': strip_id,
                'nome': strip_info['nome'],
                'nome_commerciale': strip_info.get('nomeCommerciale'),
                'tipo': strip_info['tipo'],
                'tensione': strip_info['tensione'],
                'ip': strip_info['ip'],
                'taglio_minimo': strip_info.get('taglioMinimo')
            }).execute()
            
            # Inserisci temperature
            for temperatura in strip_info.get('temperaturaColoreDisponibili', []):
                supabase.table('strip_temperature').insert({
                    'strip_id': strip_id,
                    'temperatura': temperatura
                }).execute()
            
            # Inserisci potenze
            potenze = strip_info.get('potenzeDisponibili', [])
            codici = strip_info.get('codiciProdotto', [])
            
            for i, potenza in enumerate(potenze):
                codice = codici[i] if i < len(codici) else None
                supabase.table('strip_potenze').insert({
                    'strip_id': strip_id,
                    'potenza': potenza,
                    'codice_prodotto': codice,
                    'indice': i
                }).execute()
            
            strip_migrate += 1
            print(f"  ✓ {strip_info['nome']}")
            
        except Exception as e:
            print(f"  ✗ Errore con {strip_id}: {e}")
    
    print(f"✅ Migrate {strip_migrate} strip LED")
    
    # STEP 3: Migra Profili
    print("\n📐 Migrazione PROFILI...")
    profili_migrati = 0
    
    for profilo in data.get('profili', []):
        try:
            # Inserisci profilo principale
            result = supabase.table('profili').insert({
                'id': profilo['id'],
                'nome': profilo['nome'],
                'categoria': profilo['categoria'],
                'note': profilo.get('note'),
                'immagine': profilo.get('immagine'),
                'lunghezza_massima': profilo.get('lunghezzaMassima', 3000)
            }).execute()
            
            # Inserisci tipologie
            for tipologia in profilo.get('tipologie', []):
                supabase.table('profili_tipologie').insert({
                    'profilo_id': profilo['id'],
                    'tipologia': tipologia
                }).execute()
            
            # Inserisci finiture
            for finitura in profilo.get('finitureDisponibili', []):
                supabase.table('profili_finiture').insert({
                    'profilo_id': profilo['id'],
                    'finitura': finitura
                }).execute()
            
            # Inserisci lunghezze
            for lunghezza in profilo.get('lunghezzeDisponibili', []):
                supabase.table('profili_lunghezze').insert({
                    'profilo_id': profilo['id'],
                    'lunghezza': lunghezza
                }).execute()
            
            # Inserisci strip compatibili
            for strip_id in profilo.get('stripLedCompatibili', []):
                supabase.table('profili_strip_compatibili').insert({
                    'profilo_id': profilo['id'],
                    'strip_id': strip_id
                }).execute()
            
            profili_migrati += 1
            print(f"  ✓ {profilo['nome']}")
            
        except Exception as e:
            print(f"  ✗ Errore con {profilo['id']}: {e}")
    
    print(f"✅ Migrati {profili_migrati} profili")
    
    # STEP 4: Migra Alimentatori
    print("\n⚡ Migrazione ALIMENTATORI...")
    alimentatori_migrati = 0
    
    for alim_id, alim_info in data.get('dettagliAlimentatori', {}).items():
        try:
            # Inserisci alimentatore principale
            result = supabase.table('alimentatori').insert({
                'id': alim_id,
                'nome': alim_info['nome'],
                'descrizione': alim_info.get('descrizione'),
                'tensione': alim_info['tensione'],
                'ip': alim_info.get('ip', 'IP20')  # Default IP20 se non specificato
            }).execute()
            
            # Inserisci potenze
            for potenza in alim_info.get('potenze', []):
                codice = alim_info.get('codici', {}).get(str(potenza))
                supabase.table('alimentatori_potenze').insert({
                    'alimentatore_id': alim_id,
                    'potenza': potenza,
                    'codice': codice
                }).execute()
            
            alimentatori_migrati += 1
            print(f"  ✓ {alim_info['nome']}")
            
        except Exception as e:
            print(f"  ✗ Errore con {alim_id}: {e}")
    
    print(f"✅ Migrati {alimentatori_migrati} alimentatori")
    
    # STEP 5: Migra Dimmer
    print("\n🎚️ Migrazione DIMMER...")
    dimmer_migrati = 0
    
    dimmer_data = data.get('dimmerazione', {})
    dimmer_list = dimmer_data.get('opzioni', [])
    codici = dimmer_data.get('codiciDimmer', {})
    nomi = dimmer_data.get('nomeDimmer', {})
    potenze_max = dimmer_data.get('potenzaMassima', {})
    spazi = dimmer_data.get('spaziNonIlluminati', {})
    tensioni = dimmer_data.get('tensione', {})
    gradi_protezione = dimmer_data.get('gradoProtezione', {})
    compatibilita = dimmer_data.get('compatibilitaDimmer', {})
    
    for dimmer_id in dimmer_list:
        if dimmer_id and dimmer_id != 'NESSUN_DIMMER':
            try:
                # Inserisci dimmer principale
                result = supabase.table('dimmer').insert({
                    'id': dimmer_id,
                    'nome': nomi.get(dimmer_id, dimmer_id),
                    'codice': codici.get(dimmer_id),
                    'potenza_massima': potenze_max.get(dimmer_id),
                    'spazio_non_illuminato': spazi.get(dimmer_id, 0),
                    'tensione': tensioni.get(dimmer_id),
                    'grado_protezione': gradi_protezione.get(dimmer_id)
                }).execute()
                
                # Inserisci compatibilità strip
                for strip_id in compatibilita.get(dimmer_id, []):
                    supabase.table('dimmer_strip_compatibili').insert({
                        'dimmer_id': dimmer_id,
                        'strip_id': strip_id
                    }).execute()
                
                dimmer_migrati += 1
                print(f"  ✓ {nomi.get(dimmer_id, dimmer_id)}")
                
            except Exception as e:
                print(f"  ✗ Errore con {dimmer_id}: {e}")
    
    print(f"✅ Migrati {dimmer_migrati} dimmer")
    
    print("\n🎉 MIGRAZIONE COMPLETATA!")
    print(f"""
Riepilogo:
- Categorie: {categorie_migrate}
- Strip LED: {strip_migrate}
- Profili: {profili_migrati}
- Alimentatori: {alimentatori_migrati}
- Dimmer: {dimmer_migrati}
    """)

if __name__ == "__main__":
    main()