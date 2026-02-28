#!/usr/bin/env python3
import json
import sqlite3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'advertising.db'
HOST = '0.0.0.0'
PORT = 4173

INITIAL_ASIN_DATA = [
    {
        'asin': 'B09ABC1234',
        'partNumber': 'PN-7742-A',
        'supplier': 'Northstar Brands',
        'seniorDirector': 'Priya Patel',
        'channel': 'Amazon.com',
        'overrideLock': False,
        'minRoas': 2.8,
        'tacosCeiling': 18.5,
        'budgetApplicable': True,
        'dailyBudget': 120,
    },
    {
        'asin': 'B0A7TUV901',
        'partNumber': 'PN-1911-Q',
        'supplier': 'Everline Consumer',
        'seniorDirector': 'Marcus Lee',
        'channel': 'Amazon Business',
        'overrideLock': True,
        'minRoas': 3.4,
        'tacosCeiling': 14.0,
        'budgetApplicable': True,
        'dailyBudget': 200,
    },
    {
        'asin': 'B078XYZ778',
        'partNumber': 'PN-0208-X',
        'supplier': 'Northstar Brands',
        'seniorDirector': 'Ariana Gomez',
        'channel': 'Amazon Fresh',
        'overrideLock': False,
        'minRoas': 2.1,
        'tacosCeiling': 22.0,
        'budgetApplicable': False,
        'dailyBudget': 0,
    },
    {
        'asin': 'B0C5LMN452',
        'partNumber': 'PN-8890-K',
        'supplier': 'Ridgeway Supply Co.',
        'seniorDirector': 'Priya Patel',
        'channel': 'Amazon Global',
        'overrideLock': True,
        'minRoas': 4.2,
        'tacosCeiling': 12.5,
        'budgetApplicable': True,
        'dailyBudget': 80,
    },
]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    conn = get_connection()
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS asin_overrides (
            asin TEXT PRIMARY KEY,
            part_number TEXT NOT NULL,
            supplier TEXT NOT NULL,
            senior_director TEXT NOT NULL,
            channel TEXT NOT NULL,
            override_lock INTEGER NOT NULL,
            min_roas REAL NOT NULL,
            tacos_ceiling REAL NOT NULL,
            budget_applicable INTEGER NOT NULL,
            daily_budget REAL NOT NULL
        )
        '''
    )
    conn.commit()
    conn.close()


def seed_defaults(force=False):
    conn = get_connection()
    existing_count = conn.execute('SELECT COUNT(*) AS count FROM asin_overrides').fetchone()['count']

    if force:
        conn.execute('DELETE FROM asin_overrides')

    if force or existing_count == 0:
        for row in INITIAL_ASIN_DATA:
            upsert_record(conn, row)

    conn.commit()
    conn.close()

    return len(INITIAL_ASIN_DATA) if force or existing_count == 0 else 0


def normalize_record(record):
    return {
        'asin': str(record.get('asin', '')).strip(),
        'partNumber': str(record.get('partNumber', '')).strip(),
        'supplier': str(record.get('supplier', '')).strip(),
        'seniorDirector': str(record.get('seniorDirector', '')).strip(),
        'channel': str(record.get('channel', '')).strip(),
        'overrideLock': bool(record.get('overrideLock', False)),
        'minRoas': float(record.get('minRoas', 0) or 0),
        'tacosCeiling': float(record.get('tacosCeiling', 0) or 0),
        'budgetApplicable': bool(record.get('budgetApplicable', False)),
        'dailyBudget': float(record.get('dailyBudget', 0) or 0),
    }


def validate_record(record):
    required = ['asin', 'partNumber', 'supplier', 'seniorDirector', 'channel']
    missing = [field for field in required if not record[field]]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")


def upsert_record(conn, record):
    normalized = normalize_record(record)
    validate_record(normalized)

    conn.execute(
        '''
        INSERT INTO asin_overrides (
            asin, part_number, supplier, senior_director, channel,
            override_lock, min_roas, tacos_ceiling, budget_applicable, daily_budget
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asin) DO UPDATE SET
            part_number = excluded.part_number,
            supplier = excluded.supplier,
            senior_director = excluded.senior_director,
            channel = excluded.channel,
            override_lock = excluded.override_lock,
            min_roas = excluded.min_roas,
            tacos_ceiling = excluded.tacos_ceiling,
            budget_applicable = excluded.budget_applicable,
            daily_budget = excluded.daily_budget
        ''',
        (
            normalized['asin'],
            normalized['partNumber'],
            normalized['supplier'],
            normalized['seniorDirector'],
            normalized['channel'],
            int(normalized['overrideLock']),
            normalized['minRoas'],
            normalized['tacosCeiling'],
            int(normalized['budgetApplicable']),
            normalized['dailyBudget'],
        ),
    )


def fetch_records():
    conn = get_connection()
    rows = conn.execute(
        '''
        SELECT
            asin,
            part_number AS partNumber,
            supplier,
            senior_director AS seniorDirector,
            channel,
            override_lock AS overrideLock,
            min_roas AS minRoas,
            tacos_ceiling AS tacosCeiling,
            budget_applicable AS budgetApplicable,
            daily_budget AS dailyBudget
        FROM asin_overrides
        ORDER BY asin
        '''
    ).fetchall()
    conn.close()

    records = []
    for row in rows:
        records.append(
            {
                'asin': row['asin'],
                'partNumber': row['partNumber'],
                'supplier': row['supplier'],
                'seniorDirector': row['seniorDirector'],
                'channel': row['channel'],
                'overrideLock': bool(row['overrideLock']),
                'minRoas': row['minRoas'],
                'tacosCeiling': row['tacosCeiling'],
                'budgetApplicable': bool(row['budgetApplicable']),
                'dailyBudget': row['dailyBudget'],
            }
        )

    return records


def fetch_suppliers():
    conn = get_connection()
    rows = conn.execute('SELECT DISTINCT supplier FROM asin_overrides ORDER BY supplier').fetchall()
    conn.close()
    return [row['supplier'] for row in rows]


class APIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/asin-overrides':
            self.respond_json(fetch_records())
            return

        if parsed.path == '/api/suppliers':
            self.respond_json(fetch_suppliers())
            return

        if parsed.path == '/':
            self.path = '/index.html'

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/seed-defaults':
            self.respond_error(HTTPStatus.NOT_FOUND, 'Endpoint not found')
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            payload = self.rfile.read(content_length) if content_length else b'{}'
            decoded = json.loads(payload.decode('utf-8') or '{}')
            force = bool(decoded.get('force', False)) if isinstance(decoded, dict) else False

            seeded_count = seed_defaults(force=force)
            self.respond_json({'seeded': seeded_count})
        except (json.JSONDecodeError, ValueError) as error:
            self.respond_error(HTTPStatus.BAD_REQUEST, str(error))

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/asin-overrides':
            self.respond_error(HTTPStatus.NOT_FOUND, 'Endpoint not found')
            return

        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length) if content_length else b'[]'

        try:
            decoded = json.loads(payload.decode('utf-8') or '[]')
            records = decoded.get('records') if isinstance(decoded, dict) else decoded
            if not isinstance(records, list):
                raise ValueError('Payload must be an array of records or {"records": [...]}')

            conn = get_connection()
            for record in records:
                upsert_record(conn, record)
            conn.commit()
            conn.close()

            self.respond_json({'updated': len(records)})
        except (json.JSONDecodeError, ValueError) as error:
            self.respond_error(HTTPStatus.BAD_REQUEST, str(error))

    def respond_json(self, payload, status=HTTPStatus.OK):
        data = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def respond_error(self, status, message):
        self.respond_json({'error': message}, status=status)


if __name__ == '__main__':
    initialize_database()
    seed_defaults(force=False)
    server = ThreadingHTTPServer((HOST, PORT), APIHandler)
    print(f'Serving app + API on http://{HOST}:{PORT}')
    print(f'Database file: {DB_PATH}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
