# verifica_tutte_special.py
from database import DatabaseManager

def trova_tutte_special_strip():
    db = DatabaseManager()
    
    print("=== TUTTE LE STRIP LED NEL DATABASE ===")
    
    # Ottieni tutte le strip
    strips = db.supabase.table('strip_led')\
        .select('id, nome_commerciale, tensione, ip')\
        .execute().data
    
    print(f"Totale strip nel database: {len(strips)}")
    
    # Cerca pattern per ogni tipo di special strip
    special_patterns = ['XMAGIS', 'XFLEX', 'XSNAKE', 'RUNNING', 'ZIGZAG', 'MG13', 'MG12', 'MAGIS', 'FLEX', 'SNAKE']
    
    print(f"\n=== RICERCA PATTERN SPECIAL STRIP ===")
    
    for pattern in special_patterns:
        print(f"\n--- Pattern '{pattern}' ---")
        matching_strips = [s for s in strips if 
                          (pattern.upper() in s['id'].upper()) or 
                          (s.get('nome_commerciale', '') and pattern.upper() in s['nome_commerciale'].upper())]
        
        print(f"Strip trovate: {len(matching_strips)}")
        for strip in matching_strips:
            print(f"  - ID: {strip['id']}")
            print(f"    Nome: {strip.get('nome_commerciale', 'N/A')}")
            print(f"    Tensione: {strip['tensione']}, IP: {strip['ip']}")
    
    print(f"\n=== ANALISI DETTAGLIATA NOMI ===")
    
    # Mostra tutti i nomi per vedere pattern nascosti
    print("Tutti gli ID delle strip:")
    for strip in sorted(strips, key=lambda x: x['id']):
        nome_comm = strip.get('nome_commerciale', 'N/A')
        print(f"  {strip['id']} -> {nome_comm}")

if __name__ == "__main__":
    trova_tutte_special_strip()