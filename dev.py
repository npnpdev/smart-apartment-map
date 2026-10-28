#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / ".dev-state"
IMPORT_STATE = STATE_DIR / "last-import.sha256"
BACKUP_FILE = ROOT / "backup.dump"
CONTAINER_DATA_DIR = "/app/scraped_data"
HEALTH_TIMEOUT = 180
DB_TIMEOUT = 90


def _enable_windows_vt() -> None:
    if os.name != "nt":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass


def _use_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if not sys.stdout.isatty():
        return False
    _enable_windows_vt()
    return True


if _use_color():
    R, B, D = "\033[0m", "\033[1m", "\033[2m"
    RED, GRN, YEL = "\033[31m", "\033[32m", "\033[33m"
    BLU, MAG, CYA = "\033[34m", "\033[35m", "\033[36m"
else:
    R = B = D = RED = GRN = YEL = BLU = MAG = CYA = ""


def hdr(text: str) -> None:
    print(f"\n{B}{CYA}=== {text} ==={R}", flush=True)


def step(text: str) -> None:
    print(f"{B}{BLU}==>{R} {text}", flush=True)


def info(text: str) -> None:
    print(f"     {D}{text}{R}", flush=True)


def note(text: str) -> None:
    print(f"     {text}", flush=True)


def ok(text: str) -> None:
    print(f"{GRN}[ ok ]{R} {text}", flush=True)


def warn(text: str) -> None:
    print(f"{YEL}[ ?? ]{R} {text}", flush=True)


def err(text: str) -> None:
    sys.stdout.flush()
    print(f"{RED}[ !! ]{R} {text}", file=sys.stderr, flush=True)


def indented(text: str) -> None:
    for line in text.rstrip().splitlines():
        print(f"     {line}", flush=True)


class Abort(Exception):
    pass


def die(text: str) -> None:
    raise Abort(text)


DC: list = []
INTERACTIVE = True


def _quiet_ok(cmd: list) -> bool:
    try:
        done = subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    except OSError:
        return False
    return done.returncode == 0


def detect_compose() -> list:
    if shutil.which("docker") and _quiet_ok(["docker", "compose", "version"]):
        return ["docker", "compose"]
    if shutil.which("docker-compose"):
        return ["docker-compose"]
    return []


def show(cmd: list) -> None:
    print(f"     {D}$ {' '.join(str(part) for part in cmd)}{R}", flush=True)


def dc_run(*args, echo: bool = True, check: bool = True):
    cmd = [*DC, *[str(a) for a in args]]
    if echo:
        show(cmd)
    done = subprocess.run(cmd)
    if check and done.returncode != 0:
        die(f"Polecenie zwrocilo blad ({done.returncode}): {' '.join(cmd)}")
    return done


def dc_out(*args):
    cmd = [*DC, *[str(a) for a in args]]
    return subprocess.run(cmd, capture_output=True, text=True, errors="replace")


def manage(*args, check: bool = True):
    return dc_run("run", "--rm", "-T", "backend", "python", "manage.py", *args, check=check)


def manage_out(*args):
    return dc_out("run", "--rm", "-T", "backend", "python", "manage.py", *args)


def ask_yn(prompt: str, default: bool = False) -> bool:
    hint = "[T/n]" if default else "[t/N]"
    if not INTERACTIVE:
        info(f"{prompt} {hint} -> {'t' if default else 'n'} (automatycznie)")
        return default
    while True:
        try:
            answer = input(f"{B}{MAG}  ?{R} {prompt} {D}{hint}{R} ").strip().lower()
        except EOFError:
            print()
            return default
        if not answer:
            return default
        if answer in ("t", "tak", "y", "yes"):
            return True
        if answer in ("n", "nie", "no"):
            return False
        warn("Odpowiedz t albo n.")


def ask_menu(prompt: str, default: int, options: list) -> int:
    print(f"{B}{MAG}  ?{R} {prompt}", flush=True)
    for number, option in enumerate(options, start=1):
        mark = f"{GRN}->{R}" if number == default else "  "
        print(f"     {mark} {B}{number}){R} {option}", flush=True)
    if not INTERACTIVE:
        info(f"wybor -> {default} (automatycznie)")
        return default
    while True:
        try:
            answer = input(f"     {D}wybor [{default}]:{R} ").strip()
        except EOFError:
            print()
            return default
        if not answer:
            return default
        if answer.isdigit() and 1 <= int(answer) <= len(options):
            return int(answer)
        warn(f"Podaj liczbe od 1 do {len(options)}.")


def read_env(path: Path) -> dict:
    values = {}
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def write_env_from_example() -> None:
    text = (ROOT / ".env.example").read_text(encoding="utf-8-sig", errors="replace")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    with open(ROOT / ".env", "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def human_size(size: int) -> str:
    if size > 1024 * 1024:
        return f"{size / 1024 / 1024:.1f} MB"
    if size > 1024:
        return f"{size / 1024:.1f} kB"
    return f"{size} B"


def count_data_lines(path: Path) -> int:
    with path.open("rb") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def http_alive(url: str, timeout: float = 3.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout):
            return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False


def service_running(service: str) -> bool:
    ids = dc_out("ps", "-q", service).stdout.split()
    if not ids:
        return False
    state = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", ids[-1]],
        capture_output=True,
        text=True,
        errors="replace",
    )
    return state.stdout.strip() == "true"


def wait_http(name: str, url: str, service: str, timeout: int = HEALTH_TIMEOUT) -> bool:
    start = time.monotonic()
    last_note = 0
    while True:
        if http_alive(url):
            ok(f"{name} odpowiada po {time.monotonic() - start:.0f}s -> {url}")
            return True
        if not service_running(service):
            err(f"Kontener '{service}' sie wywalil - powod powinien byc w logach powyzej.")
            return False
        elapsed = int(time.monotonic() - start)
        if elapsed >= timeout:
            warn(f"{name} nie odpowiedzial w {timeout}s ({url}), ale kontener chodzi - patrz w logi.")
            return False
        if elapsed // 10 > last_note:
            last_note = elapsed // 10
            info(f"czekam na {name}... ({elapsed}s)")
        time.sleep(1)


def wait_db(env: dict, timeout: int = DB_TIMEOUT) -> None:
    step("Czekam az Postgres przyjmie polaczenia...")
    user, name = env["DB_USER"], env["DB_NAME"]
    start = time.monotonic()
    hits = 0
    while True:
        tcp = dc_out("exec", "-T", "db", "pg_isready", "-h", "127.0.0.1", "-U", user, "-d", name)
        query = dc_out("exec", "-T", "db", "psql", "-U", user, "-d", name, "-c", "SELECT 1")
        if tcp.returncode == 0 and query.returncode == 0:
            hits += 1
            if hits >= 2:
                ok("Baza gotowa.")
                return
        else:
            hits = 0
        if time.monotonic() - start >= timeout:
            indented(dc_out("logs", "--tail=30", "db").stdout)
            die(f"Baza nie wstala w {timeout}s.")
        time.sleep(1)


def compose_config() -> dict:
    result = dc_out("config", "--format", "json")
    if result.returncode != 0:
        return {}
    try:
        return json.loads(result.stdout)
    except ValueError:
        return {}


def published_ports(config: dict) -> list:
    ports = []
    for service in (config.get("services") or {}).values():
        for entry in service.get("ports") or []:
            port = str(entry.get("published") or "").strip()
            if port and port not in ports:
                ports.append(port)
    return ports


def port_conflicts(ports: list, project: str) -> list:
    result = subprocess.run(
        ["docker", "ps", "--format", '{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Ports}}'],
        capture_output=True,
        text=True,
        errors="replace",
    )
    found = []
    for line in result.stdout.splitlines():
        parts = line.split("|")
        if len(parts) < 3:
            continue
        name, owner, portmap = parts[0], parts[1], parts[2]
        if owner == project:
            continue
        for port in ports:
            if f":{port}->" in portmap:
                found.append((name, owner or "-", port))
    return found


def mapped_port(service: str, inner: int, fallback: int) -> int:
    lines = dc_out("port", service, str(inner)).stdout.split()
    if lines and ":" in lines[-1]:
        try:
            return int(lines[-1].rsplit(":", 1)[1])
        except ValueError:
            pass
    return fallback


DB_STATS_PY = """
from api.models import District, NoiseZone, EducationFacility, SafetyData, Apartment, DataVersion
v = DataVersion.objects.order_by("-version_number").first()
print("districts=%d" % District.objects.count())
print("noise=%d" % NoiseZone.objects.count())
print("education=%d" % EducationFacility.objects.count())
print("safety=%d" % SafetyData.objects.count())
print("apartments=%d" % Apartment.objects.count())
print("visible=%d" % Apartment.objects.filter(is_active=True, validation_status="valid").count())
print("version=%s" % (v.version_number if v else "-"))
print("version_date=%s" % (v.created_at.strftime("%Y-%m-%d %H:%M") if v else "-"))
"""


class Ctx:
    def __init__(self) -> None:
        self.env = {}
        self.project = ""
        self.started = False
        self.logs = None
        self.db_reset = False
        self.db_restored = False
        self.csv_hash = ""
        self.csv_present = False
        self.csv_new = False
        self.districts = 0


def preflight(args, ctx: Ctx) -> None:
    print(f"\n{B}{CYA}  Smart Apartment Map - srodowisko developerskie{R}", flush=True)
    print(f"{D}  {ROOT}{R}", flush=True)

    hdr("Sprawdzenie srodowiska")

    if not shutil.which("docker"):
        die("Nie ma 'docker' w PATH. Zainstaluj Docker Desktop.")
    if not DC:
        die("Brak 'docker compose'. Zaktualizuj Dockera.")
    if not _quiet_ok(["docker", "info"]):
        die("Demon Dockera nie odpowiada - odpal Docker Desktop i sprobuj ponownie.")
    if not (ROOT / "docker-compose.yml").exists():
        die(f"Brak docker-compose.yml w {ROOT} - to nie katalog projektu.")

    version = subprocess.run(
        ["docker", "--version"], capture_output=True, text=True, errors="replace"
    ).stdout.strip()
    ok(f"Docker dziala ({version.split(',')[0]}).")

    if not (ROOT / ".env").exists():
        warn("Brak pliku .env.")
        if (ROOT / ".env.example").exists() and ask_yn("Skopiowac .env.example do .env?", True):
            write_env_from_example()
            ok("Utworzono .env (koncowki linii LF) - ustaw w nim wlasny SECRET_KEY.")
        else:
            die("Bez .env compose nie wystartuje (DB_NAME, DB_USER, DB_PASSWORD).")

    ctx.env = read_env(ROOT / ".env")
    for key in ("DB_USER", "DB_NAME"):
        if not ctx.env.get(key):
            die(f"Ustaw {key} w .env")
    ok(f"Konfiguracja z .env: baza {B}{ctx.env['DB_NAME']}{R}, uzytkownik {B}{ctx.env['DB_USER']}{R}.")

    config = compose_config()
    ctx.project = config.get("name") or ROOT.name.lower()
    info(f"projekt compose: {ctx.project}")

    conflicts = port_conflicts(published_ports(config), ctx.project)
    if conflicts:
        warn("Porty tego projektu sa juz zajete przez inne kontenery:")
        for name, owner, port in conflicts:
            note(f"port {B}{port}{R} trzyma {B}{name}{R} (projekt '{owner}')")
        info("Jesli to ten sam projekt uruchomiony z innego katalogu, odpal skrypt tam.")
        info(f"Jesli nie - zatrzymaj tamten projekt: docker compose -p {conflicts[0][1]} down")
        die("Nie startuje, bo compose i tak by sie wywalil na zajetym porcie.")

    STATE_DIR.mkdir(parents=True, exist_ok=True)


def step_db(args, ctx: Ctx) -> None:
    hdr("1/4  Baza danych")

    volumes = subprocess.run(
        [
            "docker",
            "volume",
            "ls",
            "-q",
            "--filter",
            f"label=com.docker.compose.project={ctx.project}",
            "--filter",
            "label=com.docker.compose.volume=postgres_data",
        ],
        capture_output=True,
        text=True,
        errors="replace",
    ).stdout.split()

    if volumes:
        info(f"istniejacy wolumen z danymi: {volumes[0]}")
    else:
        info("brak wolumenu z danymi - baza powstanie od zera")

    action = args.db_action
    if action is None:
        options = [
            "zostaw baze jak jest",
            "wyczysc (usun wolumen) i postaw pusta baze",
        ]
        if BACKUP_FILE.exists():
            options.append(
                f"wyczysc i odtworz z backup.dump ({human_size(BACKUP_FILE.stat().st_size)})"
            )
        choice = ask_menu("Co zrobic z baza?", 1 if volumes else 2, options)
        action = {1: "keep", 2: "wipe", 3: "restore"}[choice]

    if action == "restore" and not BACKUP_FILE.exists():
        die(f"Nie ma pliku {BACKUP_FILE} - nie ma z czego odtwarzac.")

    if action == "keep":
        info("Baza zostaje nietknieta.")
    else:
        step("Usuwam kontenery i wolumen bazy...")
        dc_run("down", "-v", "--remove-orphans")
        ctx.db_reset = True
        ok("Stara baza skasowana.")

    step("Podnosze Postgresa...")
    dc_run("up", "-d", "db")
    ctx.started = True
    wait_db(ctx.env)

    if action == "restore":
        step("Odtwarzam baze z backup.dump (moze chwile potrwac)...")
        dc_run("cp", BACKUP_FILE, "db:/tmp/backup.dump")
        restore = dc_out(
            "exec", "-T", "db", "pg_restore",
            "-U", ctx.env["DB_USER"], "-d", ctx.env["DB_NAME"],
            "--clean", "--if-exists", "--no-owner", "/tmp/backup.dump",
        )
        output = (restore.stdout + restore.stderr).strip()
        if output:
            indented(output)
        if restore.returncode != 0:
            die("pg_restore nie odtworzyl bazy. Baza jest teraz pusta - popraw problem i uruchom ponownie.")
        ok("Baza odtworzona z backup.dump.")
        ctx.db_reset = False
        ctx.db_restored = True


def step_migrations(args, ctx: Ctx) -> None:
    hdr("2/4  Migracje")

    if args.migrate_mode == "skip":
        info("Migracje pominiete (--no-migrate).")
        return

    step("Sprawdzam, czy sa zalegle migracje...")
    check = manage_out("migrate", "--check")
    pending = check.returncode != 0
    if pending:
        blob = (check.stdout + check.stderr).lower()
        if any(m in blob for m in ("could not connect", "operationalerror", "connection refused")):
            indented(check.stdout + check.stderr)
            warn("Sprawdzenie zwrocilo blad polaczenia - traktuje jak brak migracji.")
        warn("Sa niezaaplikowane migracje.")
    else:
        ok("Baza zgodna z migracjami - nic do roboty.")

    did_migrate = False
    if ctx.db_reset:
        step("Swieza baza - odpalam migracje bez pytania.")
        manage("migrate")
        did_migrate = True
    elif ctx.db_restored and pending:
        step("Dump jest starszy niz migracje w repo - dociagam je bez pytania.")
        manage("migrate")
        did_migrate = True
    elif pending:
        if args.migrate_mode == "auto" or ask_yn("Odpalic 'manage.py migrate'?", True):
            manage("migrate")
            did_migrate = True
        else:
            warn("Pominieto migracje - backend moze sypac bledami.")

    if did_migrate:
        ok("Migracje zaaplikowane.")

    if manage_out("makemigrations", "--check", "--dry-run").returncode != 0:
        warn("W modelach sa zmiany bez wygenerowanej migracji.")
        if ask_yn("Wygenerowac je teraz (makemigrations + migrate)?", False):
            manage("makemigrations")
            manage("migrate")
            ok("Nowe migracje wygenerowane i zaaplikowane.")


def read_db_stats() -> dict:
    result = manage_out("shell", "-c", DB_STATS_PY)
    if result.returncode != 0:
        return {}
    stats = {}
    for line in result.stdout.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            stats[key.strip()] = value.strip()
    return stats


def step_data(args, ctx: Ctx) -> None:
    hdr("3/4  Dane")

    step("Odczytuje stan bazy...")
    stats = read_db_stats()
    if stats:
        ctx.districts = int(stats.get("districts") or 0)
        note(
            f"dzielnice {B}{stats.get('districts', '?')}{R}   "
            f"strefy halasu {B}{stats.get('noise', '?')}{R}   "
            f"edukacja {B}{stats.get('education', '?')}{R}   "
            f"bezpieczenstwo {B}{stats.get('safety', '?')}{R}"
        )
        note(
            f"mieszkania {B}{stats.get('apartments', '?')}{R}   "
            f"widoczne na mapie {B}{stats.get('visible', '?')}{R}"
        )
        note(
            f"ostatnia wersja importu: {B}{stats.get('version', '-')}{R} "
            f"({stats.get('version_date', '-')})"
        )
    else:
        warn("Nie udalo sie odczytac stanu bazy - brak tabel albo pominiete migracje.")

    data_file = Path(args.data_file)
    if data_file.exists():
        ctx.csv_present = True
        ctx.csv_hash = sha256_of(data_file)
        stamp = datetime.fromtimestamp(data_file.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        note(
            f"plik scrapera {B}{data_file.name}{R} - ok. {count_data_lines(data_file)} linii, "
            f"{human_size(data_file.stat().st_size)}, {stamp}"
        )
        previous = IMPORT_STATE.read_text(encoding="utf-8") if IMPORT_STATE.exists() else ""
        if ctx.csv_hash in previous:
            info("ten sam plik byl juz importowany tym skryptem - nowych danych nie ma")
        else:
            ctx.csv_new = True
            if previous:
                ok("CSV zmienil sie od ostatniego importu - przyszly nowe dane.")
            else:
                info("brak sladu importu tego pliku (mozliwe, ze robiony recznie) - traktuje jako nowy")
    else:
        warn(f"Brak pliku {data_file} - import ze scrapera niedostepny.")

    action = args.data_action
    if action is None:
        default = 1
        if ctx.districts == 0:
            default = 5 if ctx.csv_present else 2
        elif ctx.csv_new:
            default = 4
        choice = ask_menu(
            "Co zaladowac?",
            default,
            [
                "nic nie laduj",
                "load_all - warstwy bazowe (dzielnice, halas, edukacja, bezpieczenstwo, seed)",
                "load_all --clear - to samo, ale najpierw czysci tabele",
                f"import_scraped_apartments - mieszkania z {data_file.name}",
                "load_all + import_scraped_apartments - pelny komplet",
                "import --dry-run - tylko sprawdz plik, nic nie zapisuj",
            ],
        )
        action = {1: "none", 2: "base", 3: "base-clear", 4: "import", 5: "all", 6: "dry"}[choice]

    def do_import(*extra) -> bool:
        if not ctx.csv_present:
            warn("Pomijam import - nie ma pliku CSV.")
            return False
        manage("import_scraped_apartments", "--path", f"{CONTAINER_DATA_DIR}/{data_file.name}", *extra)
        return True

    def remember_import() -> None:
        if not ctx.csv_hash:
            return
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        IMPORT_STATE.write_text(f"{ctx.csv_hash}  {data_file.name}  {stamp}\n", encoding="utf-8")

    if action == "none":
        info("Nic nie laduje.")
    elif action == "base":
        step("load_all...")
        manage("load_all")
        ok("Warstwy bazowe zaladowane.")
    elif action == "base-clear":
        step("load_all --clear...")
        manage("load_all", "--clear")
        ok("Warstwy bazowe przeladowane od zera.")
    elif action == "import":
        step("import_scraped_apartments...")
        if do_import():
            remember_import()
        ok("Import mieszkan zakonczony.")
    elif action == "all":
        step("load_all, a potem import_scraped_apartments...")
        manage("load_all")
        if do_import():
            remember_import()
        ok("Komplet danych zaladowany.")
    elif action == "dry":
        step("import --dry-run - nic nie zapisuje...")
        do_import("--dry-run")
        ok("Dry-run zakonczony.")


def step_run(args, ctx: Ctx) -> None:
    hdr("4/4  Uruchomienie")

    services = ["backend", "frontend", "nginx"]
    if args.docs:
        services.append("docs")

    up_args = ["up", "-d"]
    if args.build:
        up_args.append("--build")

    step(f"Startuje: {' '.join(services)}")
    dc_run(*up_args, *services)
    ctx.started = True

    nginx_port = mapped_port('nginx', 80, 80)
    docs_url = f"http://localhost:{mapped_port('docs', 8000, 8001)}"

    print(f"\n{D}{YEL}----- logi kontenerow -----{R}", flush=True)
    ctx.logs = subprocess.Popen([*DC, "logs", "-f", "--tail=15", *services])

    time.sleep(1)
    wait_http("Backend", f"http://localhost:{nginx_port}/api/health/", "backend")
    wait_http("Frontend", f"http://localhost:{nginx_port}/", "frontend")

    app_url = f"http://localhost:{nginx_port}"
    lines = [
        "",
        f"{B}{GRN}============================================================={R}",
        f"  {B}Srodowisko dziala{R}",
        "",
        f"  Aplikacja   {B}{CYA}{app_url}{R}",
        f"  API health  {D}{app_url}/api/health/{R}",
        f"  Admin       {D}{app_url}/admin/{R}",
        f"  Mailpit     {D}http://localhost:8025{R}",
    ]
    if args.docs:
        lines.append(f"  Docs        {D}{docs_url}{R}")
    lines += [
        "",
        f"  {D}Ponizej leca logi backendu i frontendu.{R}",
        f"  {B}{YEL}Ctrl+C{R} = zatrzymanie wszystkich kontenerow.",
        f"{B}{GRN}============================================================={R}",
        "",
    ]
    print("\n".join(lines), flush=True)

    ctx.logs.wait()


def cleanup(args, ctx: Ctx) -> None:
    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
    except (ValueError, OSError):
        pass

    if ctx.logs is not None and ctx.logs.poll() is None:
        ctx.logs.terminate()
        try:
            ctx.logs.wait(timeout=10)
        except subprocess.TimeoutExpired:
            ctx.logs.kill()

    if not ctx.started:
        return

    print()
    if args.keep_up:
        warn("--keep-up: kontenery zostaja. Zatrzymasz je przez: docker compose down")
        return

    step("Zatrzymuje kontenery...")
    subprocess.run([*DC, "down", "--remove-orphans"])
    ok("Wszystko zatrzymane, nic nie wisi.")


def parse_args():
    parser = argparse.ArgumentParser(
        prog="dev.py",
        description="Lokalne srodowisko Smart Apartment Map: baza, migracje, dane, backend + frontend.",
        epilog="Bez opcji skrypt prowadzi przez kolejne kroki i pyta, podpowiadajac "
        "domyslny wybor na podstawie tego, co faktycznie jest do zrobienia.",
    )

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", dest="db_action", action="store_const", const="wipe",
                       help="wyczysc baze (usun wolumen) i postaw pusta")
    group.add_argument("--restore", dest="db_action", action="store_const", const="restore",
                       help="wyczysc baze i odtworz z backup.dump")
    group.add_argument("--keep-db", dest="db_action", action="store_const", const="keep",
                       help="nie ruszaj bazy")

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--migrate", dest="migrate_mode", action="store_const", const="auto",
                       help="odpal migracje bez pytania")
    group.add_argument("--no-migrate", dest="migrate_mode", action="store_const", const="skip",
                       help="pomin krok migracji")

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--load", dest="data_action", action="store_const", const="base",
                       help="load_all (warstwy bazowe)")
    group.add_argument("--load-clear", dest="data_action", action="store_const", const="base-clear",
                       help="load_all --clear (reimport od zera)")
    group.add_argument("--import", dest="data_action", action="store_const", const="import",
                       help="import_scraped_apartments (CSV ze scrapera)")
    group.add_argument("--load-all", dest="data_action", action="store_const", const="all",
                       help="load_all + import_scraped_apartments")
    group.add_argument("--dry-run", dest="data_action", action="store_const", const="dry",
                       help="import --dry-run, nic nie zapisuje")
    group.add_argument("--no-load", dest="data_action", action="store_const", const="none",
                       help="nic nie laduj")

    parser.add_argument("--data-file", default=ROOT / "data" / "complete_listings.csv",
                        help="inny CSV do importu (domyslnie data/complete_listings.csv)")
    parser.add_argument("--docs", action="store_true", help="podnies takze serwis docs")
    parser.add_argument("--build", action="store_true", help="przebuduj obrazy (docker compose up --build)")
    parser.add_argument("--keep-up", action="store_true", help="po Ctrl+C zostaw kontenery uruchomione")
    parser.add_argument("-y", "--yes", action="store_true",
                        help="nie pytaj o nic, przyjmij domyslne odpowiedzi")

    parser.set_defaults(db_action=None, migrate_mode=None, data_action=None)
    return parser.parse_args()


def main() -> int:
    global DC, INTERACTIVE

    args = parse_args()
    INTERACTIVE = sys.stdin.isatty() and not args.yes
    DC = detect_compose()

    ctx = Ctx()
    try:
        preflight(args, ctx)
        step_db(args, ctx)
        step_migrations(args, ctx)
        step_data(args, ctx)
        step_run(args, ctx)
        return 0
    except Abort as stop:
        err(str(stop))
        return 1
    except KeyboardInterrupt:
        print()
        return 130
    finally:
        cleanup(args, ctx)


if __name__ == "__main__":
    sys.exit(main())
