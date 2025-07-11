from database import DatabaseManager
import os

print("Test connessione database...")
print(f"SUPABASE_URL: {os.environ.get('SUPABASE_URL')}")
print(f"SUPABASE_KEY presente: {'Sì' if os.environ.get('SUPABASE_KEY') else 'No'}")

try:
    db = DatabaseManager()
    print("✅ DatabaseManager inizializzato")
    
    # Test 1: Categorie
    categorie = db.get_categorie()
    print(f"\n✅ Trovate {len(categorie)} categorie:")
    for cat in categorie:
        print(f"  - {cat['id']}: {cat['nome']}")
    
    # Test 2: Profili per 'incasso'
    print("\nTest profili per categoria 'incasso'...")
    profili = db.get_profili_by_categoria('incasso')
    print(f"✅ Trovati {len(profili)} profili")
    
except Exception as e:
    print(f"\n❌ ERRORE: {e}")
    import traceback
    traceback.print_exc()