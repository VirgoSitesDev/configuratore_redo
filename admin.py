from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash
import os
from database import DatabaseManager
import logging
from datetime import datetime
import json

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
db = DatabaseManager()

# Password admin da variabile ambiente
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

def require_admin_login():
    """Verifica se l'admin è loggato"""
    if 'admin_logged_in' not in session:
        return redirect(url_for('admin.login'))
    return None

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Password errata', 'error')
    
    return render_template('admin/login.html')

@admin_bp.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin.login'))

@admin_bp.route('/')
@admin_bp.route('/dashboard')
def dashboard():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        # Statistiche generali
        stats = {}

        # Conta profili (from profili_test table - shows actual entries displayed in admin)
        profili = db.supabase.table('profili_test').select('*').execute()
        stats['profili'] = len(profili.data) if profili.data else 0

        # Conta strip LED (from strip_test table - shows actual entries displayed in admin)
        strips = db.supabase.table('strip_test').select('*').execute()
        stats['strip_led'] = len(strips.data) if strips.data else 0

        # Conta alimentatori (from alimentatori_test table - shows actual entries displayed in admin)
        alimentatori = db.supabase.table('alimentatori_test').select('*').execute()
        stats['alimentatori'] = len(alimentatori.data) if alimentatori.data else 0

        # Conta dimmer
        dimmer = db.supabase.table('dimmer').select('*').execute()
        stats['dimmer'] = len(dimmer.data) if dimmer.data else 0

        # Conta categorie
        categorie = db.supabase.table('categorie').select('*').execute()
        stats['categorie'] = len(categorie.data) if categorie.data else 0

        # Conta accessori
        tappi = db.supabase.table('tappi').select('*').execute()
        stats['tappi'] = len(tappi.data) if tappi.data else 0

        staffe = db.supabase.table('staffe').select('*').execute()
        stats['staffe'] = len(staffe.data) if staffe.data else 0

        diffusori = db.supabase.table('diffusori').select('*').execute()
        stats['diffusori'] = len(diffusori.data) if diffusori.data else 0

        return render_template('admin/dashboard.html', stats=stats)
        
    except Exception as e:
        logging.error(f"Errore dashboard admin: {str(e)}")
        flash('Errore nel caricamento della dashboard', 'error')
        return render_template('admin/dashboard.html', stats={})

# =========================
# GESTIONE CATEGORIE
# =========================

@admin_bp.route('/categorie')
def categorie():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        categorie = db.supabase.table('categorie').select('*').execute()
        return render_template('admin/categorie.html', categorie=categorie.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento categorie: {str(e)}")
        flash('Errore nel caricamento delle categorie', 'error')
        return render_template('admin/categorie.html', categorie=[])

@admin_bp.route('/categorie/add', methods=['POST'])
def add_categoria():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.json
        result = db.supabase.table('categorie').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/categorie/update/<categoria_id>', methods=['PUT'])
def update_categoria(categoria_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.json
        result = db.supabase.table('categorie').update(data).eq('id', categoria_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/categorie/delete/<categoria_id>', methods=['DELETE'])
def delete_categoria(categoria_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        result = db.supabase.table('categorie').delete().eq('id', categoria_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE PROFILI
# =========================

@admin_bp.route('/profili')
def profili():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Fetch categories for dropdown
        categorie = db.supabase.table('categorie').select('*').execute()

        # Fetch all profili_test entries (this is now the single source of truth)
        profili_test = db.supabase.table('profili_test').select('*').execute()

        # Build list directly from profili_test with all fields
        profili_combinati = []
        for item in (profili_test.data or []):
            famiglia = item.get('famiglia', 'N/A')

            # Generate image path from famiglia name
            img_path = f"/static/img/{famiglia.lower()}.jpg"

            profili_combinati.append({
                'codice_listino': item.get('codice_listino'),  # Primary key
                'profilo_id': famiglia,  # famiglia is the profile ID
                'nome': famiglia,
                'categoria': item.get('categoria', 'N/A'),
                'immagine': item.get('immagine') or img_path,  # Use DB value or generate from famiglia (handles empty strings)
                'finitura': item.get('finitura'),
                'lunghezza': item.get('lunghezza'),
                'larghezza': item.get('larghezza'),  # New field
                'descrizione': item.get('descrizione'),
                'due_tagli': item.get('due_tagli'),
                'prezzo': item.get('prezzo'),
                'visibile': item.get('visibile', True)
            })

        return render_template('admin/profili.html',
                             profili_combinati=profili_combinati,
                             categorie=categorie.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento profili: {str(e)}")
        flash('Errore nel caricamento dei profili', 'error')
        return render_template('admin/profili.html', profili_combinati=[], categorie=[])

@admin_bp.route('/profili/add_complete', methods=['POST'])
def add_profilo_complete():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        nome = request.form.get('nome')  # This is the famiglia
        categoria = request.form.get('categoria')
        codice_listino = request.form.get('codice_listino')
        finitura = request.form.get('finitura')
        lunghezza_mm = request.form.get('lunghezza_mm')
        larghezza_mm = request.form.get('larghezza_mm')
        prezzo_euro = request.form.get('prezzo_euro')
        descrizione = request.form.get('descrizione', '')

        # Handle tipologie checkboxes
        # profilo_intero checkbox determines due_tagli value
        # due_tagli = True -> both "profilo_intero" and "taglio_misura"
        # due_tagli = False -> only "taglio_misura"
        profilo_intero_checked = request.form.get('profilo_intero') == 'true'
        due_tagli = profilo_intero_checked

        # Handle file upload
        immagine_url = None
        if 'immagine' in request.files:
            file = request.files['immagine']
            if file and file.filename:
                import os
                from werkzeug.utils import secure_filename
                import time

                # Get the absolute path to static/img folder
                base_dir = os.path.dirname(os.path.abspath(__file__))
                upload_folder = os.path.join(base_dir, 'static', 'img', 'profili')
                os.makedirs(upload_folder, exist_ok=True)

                # Save file with secure filename and timestamp
                filename = secure_filename(file.filename)
                timestamp = str(int(time.time()))
                name, ext = os.path.splitext(filename)
                filename = f"{name}_{timestamp}{ext}"

                file_path = os.path.join(upload_folder, filename)
                file.save(file_path)

                # Store relative URL for database
                immagine_url = f"/static/img/profili/{filename}"

        # Insert into profili_test table (simplified approach)
        profilo_test_data = {
            'codice_listino': codice_listino,  # Primary key
            'famiglia': nome,
            'categoria': categoria,
            'descrizione': descrizione,
            'finitura': finitura,
            'lunghezza': int(lunghezza_mm),
            'larghezza': float(larghezza_mm) if larghezza_mm else 0,
            'prezzo': float(prezzo_euro),
            'due_tagli': due_tagli  # True = both tipologie, False = only taglio_misura
        }

        # Add image URL to profili_test if provided
        if immagine_url:
            profilo_test_data['immagine'] = immagine_url

        test_result = db.supabase.table('profili_test').insert(profilo_test_data).execute()

        return jsonify({'success': True, 'data': test_result.data})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logging.error(f"Errore aggiunta profilo completo: {str(e)}\n{error_trace}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/add', methods=['POST'])
def add_profilo():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/update/<profilo_id>', methods=['PUT'])
def update_profilo(profilo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili').update(data).eq('id', profilo_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/delete/<profilo_id>', methods=['DELETE'])
def delete_profilo(profilo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili').delete().eq('id', profilo_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for profili_test (individual price entries)
@admin_bp.route('/profili/prezzi/update/<path:codice_listino>', methods=['PUT'])
def update_profilo_prezzo(codice_listino):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Check if this is a file upload (FormData) or JSON request
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle file upload
            data = {}
            for key, value in request.form.items():
                if key in ['lunghezza', 'larghezza', 'prezzo']:
                    data[key] = float(value) if '.' in value else int(value)
                else:
                    data[key] = value

            # Handle image file if present
            if 'immagine' in request.files:
                file = request.files['immagine']
                if file and file.filename:
                    import os
                    from werkzeug.utils import secure_filename

                    # Create upload directory if it doesn't exist
                    upload_dir = os.path.join('static', 'uploads', 'profili')
                    os.makedirs(upload_dir, exist_ok=True)

                    # Generate unique filename
                    filename = secure_filename(file.filename)
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    unique_filename = f"{timestamp}_{filename}"
                    filepath = os.path.join(upload_dir, unique_filename)

                    # Save file
                    file.save(filepath)

                    # Store relative URL path in database
                    data['immagine'] = f"/static/uploads/profili/{unique_filename}"
        else:
            # Handle regular JSON update
            data = request.json

        # Update profili_test table
        result = db.supabase.table('profili_test').update(data).eq('codice_listino', codice_listino).execute()

        # If categoria is being updated, also update the profili table
        if 'categoria' in data and 'famiglia' in data:
            profilo_id = data['famiglia']
            db.supabase.table('profili').update({'categoria': data['categoria']}).eq('id', profilo_id).execute()

        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/prezzi/add', methods=['POST'])
def add_profilo_prezzo():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili_test').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/prezzi/delete/<path:codice_listino>', methods=['DELETE'])
def delete_profilo_prezzo(codice_listino):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili_test').delete().eq('codice_listino', codice_listino).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE STRIP LED
# =========================

@admin_bp.route('/strip_led')
def strip_led():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Fetch all data from strip_test (consolidated table)
        strips_data = db.supabase.table('strip_test').select('*').execute()

        # Build list directly from strip_test
        strips_combinati = []
        for strip in (strips_data.data or []):
            strips_combinati.append({
                'codice_completo': strip.get('codice_completo'),
                'strip_id': strip.get('strip_id'),
                'tipo': strip.get('tipo'),
                'nome_commerciale': strip.get('nome_commerciale'),
                'tensione': strip.get('tensione'),
                'ip': strip.get('ip'),
                'lunghezza': strip.get('lunghezza'),
                'larghezza': strip.get('larghezza'),
                'giuntabile': strip.get('giuntabile'),
                'taglio_minimo': strip.get('taglio_minimo', '-'),
                'temperatura': strip.get('temperatura'),
                'potenza': strip.get('potenza'),
                'codice_completo': strip.get('codice_completo'),
                'codice_prodotto': strip.get('codice_prodotto'),
                'prezzo': strip.get('prezzo'),
                'descrizione': strip.get('descrizione'),
                'visibile': strip.get('visibile', True)
            })

        return render_template('admin/strip_led.html', strips=strips_combinati)
    except Exception as e:
        logging.error(f"Errore caricamento strip LED: {str(e)}")
        flash('Errore nel caricamento delle strip LED', 'error')
        return render_template('admin/strip_led.html', strips=[])

@admin_bp.route('/strip_led/add', methods=['POST'])
def add_strip_led():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        eccezioni = data.pop('eccezioni', [])  # Extract eccezioni before inserting strip

        # Insert strip
        result = db.supabase.table('strip_test').insert(data).execute()

        # If strip was created successfully and there are eccezioni, insert them
        if result.data and eccezioni:
            strip_codice = data['id']  # The strip ID/codice
            for profilo_famiglia in eccezioni:
                try:
                    db.supabase.table('strip_profilo_eccezioni').insert({
                        'strip_codice': strip_codice,
                        'profilo_famiglia': profilo_famiglia
                    }).execute()
                except Exception as eccezione_err:
                    logging.warning(f"Errore inserimento eccezione {strip_codice} -> {profilo_famiglia}: {str(eccezione_err)}")

        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/strip_led/update/<path:codice_completo>', methods=['PUT'])
def update_strip_led(codice_completo):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('strip_test').update(data).eq('codice_completo', codice_completo).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/strip_led/delete/<path:codice_completo>', methods=['DELETE'])
def delete_strip_led(codice_completo):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('strip_test').delete().eq('codice_completo', codice_completo).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/get_profilo_famiglie', methods=['GET'])
def get_profilo_famiglie():
    """Get all unique profile families (famiglia) from profili_test table"""
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Get all unique famiglia values from profili_test
        result = db.supabase.table('profili_test')\
            .select('famiglia')\
            .eq('visibile', True)\
            .execute()

        # Extract unique famiglie
        famiglie = sorted(list(set([row['famiglia'] for row in result.data if row.get('famiglia')])))

        return jsonify({'success': True, 'famiglie': famiglie})
    except Exception as e:
        logging.error(f"Errore caricamento famiglie profili: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE ALIMENTATORI
# =========================

@admin_bp.route('/alimentatori')
def alimentatori():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Fetch all data from alimentatori_test (consolidated table)
        alimentatori_data = db.supabase.table('alimentatori_test').select('*').execute()

        # Build list directly from alimentatori_test
        alimentatori_list = []
        for alimentatore in (alimentatori_data.data or []):
            alimentatori_list.append({
                'codice': alimentatore.get('codice'),
                'alimentatore_id': alimentatore.get('alimentatore_id'),
                'nome': alimentatore.get('nome'),
                'descrizione': alimentatore.get('descrizione'),
                'tensione': alimentatore.get('tensione'),
                'ip': alimentatore.get('ip'),
                'potenza': alimentatore.get('potenza'),
                'prezzo': alimentatore.get('prezzo'),
                'visibile': alimentatore.get('visibile', True)
            })

        return render_template('admin/alimentatori.html', alimentatori=alimentatori_list)
    except Exception as e:
        logging.error(f"Errore caricamento alimentatori: {str(e)}")
        flash('Errore nel caricamento degli alimentatori', 'error')
        return render_template('admin/alimentatori.html', alimentatori=[])

@admin_bp.route('/alimentatori/add', methods=['POST'])
def add_alimentatore():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('alimentatori_test').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/alimentatori/update/<path:codice>', methods=['PUT'])
def update_alimentatore(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('alimentatori_test').update(data).eq('codice', codice).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/alimentatori/delete/<path:codice>', methods=['DELETE'])
def delete_alimentatore(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('alimentatori_test').delete().eq('codice', codice).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE DIMMER
# =========================

@admin_bp.route('/dimmer')
def dimmer():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        dimmer = db.supabase.table('dimmer').select('*').execute()
        return render_template('admin/dimmer.html', dimmer=dimmer.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento dimmer: {str(e)}")
        flash('Errore nel caricamento dei dimmer', 'error')
        return render_template('admin/dimmer.html', dimmer=[])

@admin_bp.route('/dimmer/add', methods=['POST'])
def add_dimmer():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('dimmer').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/dimmer/update/<dimmer_id>', methods=['PUT'])
def update_dimmer(dimmer_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('dimmer').update(data).eq('id', dimmer_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/dimmer/delete/<dimmer_id>', methods=['DELETE'])
def delete_dimmer(dimmer_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('dimmer').delete().eq('id', dimmer_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE CONFIGURAZIONI SALVATE
# =========================

@admin_bp.route('/configurazioni')
def configurazioni():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        configs = db.supabase.table('configurazioni_salvate').select('*').order('created_at', desc=True).execute()
        return render_template('admin/configurazioni.html', configurazioni=configs.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento configurazioni: {str(e)}")
        flash('Errore nel caricamento delle configurazioni', 'error')
        return render_template('admin/configurazioni.html', configurazioni=[])

@admin_bp.route('/configurazioni/delete/<config_id>', methods=['DELETE'])
def delete_configurazione(config_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        result = db.supabase.table('configurazioni_salvate').delete().eq('id', config_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione configurazione: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# OPERAZIONI IN BLOCCO
# =========================

# =========================
# GESTIONE TAPPI
# =========================

@admin_bp.route('/tappi')
def tappi():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        tappi = db.supabase.table('tappi').select('*').execute()
        return render_template('admin/tappi.html', tappi=tappi.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento tappi: {str(e)}")
        flash('Errore nel caricamento dei tappi', 'error')
        return render_template('admin/tappi.html', tappi=[])

@admin_bp.route('/tappi/add', methods=['POST'])
def add_tappo():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('tappi').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta tappo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/tappi/update/<codice>', methods=['PUT'])
def update_tappo(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('tappi').update(data).eq('codice', codice).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento tappo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/tappi/delete/<codice>', methods=['DELETE'])
def delete_tappo(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('tappi').delete().eq('codice', codice).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione tappo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE STAFFE
# =========================

@admin_bp.route('/staffe')
def staffe():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        staffe = db.supabase.table('staffe').select('*').execute()
        return render_template('admin/staffe.html', staffe=staffe.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento staffe: {str(e)}")
        flash('Errore nel caricamento delle staffe', 'error')
        return render_template('admin/staffe.html', staffe=[])

@admin_bp.route('/staffe/add', methods=['POST'])
def add_staffa():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('staffe').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta staffa: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/staffe/update/<codice>', methods=['PUT'])
def update_staffa(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('staffe').update(data).eq('codice', codice).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento staffa: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/staffe/delete/<codice>', methods=['DELETE'])
def delete_staffa(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('staffe').delete().eq('codice', codice).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione staffa: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE DIFFUSORI
# =========================

@admin_bp.route('/diffusori')
def diffusori():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        diffusori = db.supabase.table('diffusori').select('*').execute()
        return render_template('admin/diffusori.html', diffusori=diffusori.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento diffusori: {str(e)}")
        flash('Errore nel caricamento dei diffusori', 'error')
        return render_template('admin/diffusori.html', diffusori=[])

@admin_bp.route('/diffusori/add', methods=['POST'])
def add_diffusore():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('diffusori').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta diffusore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/diffusori/update/<codice>', methods=['PUT'])
def update_diffusore(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('diffusori').update(data).eq('codice', codice).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento diffusore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/diffusori/delete/<codice>', methods=['DELETE'])
def delete_diffusore(codice):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('diffusori').delete().eq('codice', codice).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione diffusore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# OPERAZIONI IN BLOCCO
# =========================

@admin_bp.route('/toggle-visibility', methods=['POST'])
def toggle_visibility():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        table = data.get('table')
        codice = data.get('codice')
        visibile = data.get('visibile')

        if not table or codice is None or visibile is None:
            return jsonify({'success': False, 'error': 'Parametri mancanti'})

        # Validazione tabella per sicurezza
        allowed_tables = ['profili_test', 'strip_test', 'alimentatori_test', 'dimmer', 'tappi', 'staffe', 'diffusori']
        if table not in allowed_tables:
            return jsonify({'success': False, 'error': 'Tabella non valida'})

        # Different tables use different primary keys
        if table == 'profili_test':
            id_field = 'codice_listino'
        elif table == 'strip_test':
            id_field = 'codice_completo'
        elif table == 'dimmer':
            id_field = 'id'
        else:
            id_field = 'codice'

        # Update visibility
        result = db.supabase.table(table).update({'visibile': visibile}).eq(id_field, codice).execute()

        return jsonify({'success': True, 'data': result.data})

    except Exception as e:
        logging.error(f"Errore toggle visibilità: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/bulk-delete', methods=['POST'])
def bulk_delete():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        table = data.get('table')
        ids = data.get('ids', [])

        if not table or not ids:
            return jsonify({'success': False, 'error': 'Parametri mancanti'})

        # Validazione tabella per sicurezza
        allowed_tables = ['categorie', 'profili', 'profili_test', 'strip_led', 'strip_test', 'alimentatori_test', 'dimmer', 'configurazioni_salvate', 'tappi', 'staffe', 'diffusori']
        if table not in allowed_tables:
            return jsonify({'success': False, 'error': 'Tabella non valida'})

        # Different tables use different primary keys
        if table == 'profili_test':
            id_field = 'codice_listino'
        elif table == 'strip_test':
            id_field = 'codice_completo'
        elif table in ['tappi', 'staffe', 'diffusori', 'alimentatori_test']:
            id_field = 'codice'
        else:
            id_field = 'id'

        for item_id in ids:
            db.supabase.table(table).delete().eq(id_field, item_id).execute()

        return jsonify({'success': True, 'deleted_count': len(ids)})

    except Exception as e:
        logging.error(f"Errore eliminazione in blocco: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})