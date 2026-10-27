# Mac mini + DuckDNS + Docker + Nginx 배포

구성: Nginx 정적 서버 + DuckDNS 공인 IPv4 갱신기 + Certbot 인증서 갱신기. Intel/Apple Silicon 맥미니 모두 같은 Compose를 사용합니다. Mac에 별도 Python/Node 설치는 필요하지 않습니다. 앱 이미지 빌드에서 실제 어휘 6,000개 이상 검증을 실행합니다.

## 1. 네트워크

1. DuckDNS에서 서브도메인을 생성합니다. 예: `my-wordloom.duckdns.org`.
2. Docker Desktop을 실행하고 맥미니 LAN IP를 공유기의 DHCP 예약으로 고정합니다.
3. 공유기에서 외부 **TCP 80 → 맥미니 80**, **TCP 443 → 맥미니 443**을 전달합니다. 이 Nginx 구성에는 UDP 포트 전달이 필요하지 않습니다.
4. macOS 방화벽에서 Docker Desktop 수신 연결을 허용합니다. 다른 서비스가 80/443을 사용 중이면 포트 충돌을 먼저 해결합니다.

공인 IPv4로 외부 접근이 가능한 회선을 전제로 합니다. CGNAT/사설 WAN이면 통신사 공인 IP 제공 또는 별도 터널이 필요하며, 이중 공유기라면 양쪽에서 포트포워딩해야 합니다. 잘못된 DuckDNS AAAA 레코드는 정리하세요. 갱신기는 IPv4만 갱신합니다.

## 2. 환경 변수

프로젝트 루트에서:

```sh
cp .env.example .env
nano .env
```

```dotenv
DUCKDNS_SUBDOMAIN=my-wordloom
DUCKDNS_TOKEN=실제-DuckDNS-토큰
LETSENCRYPT_EMAIL=실제-운영자-이메일
```

서브도메인에는 `.duckdns.org`를 붙이지 않습니다. DOMAIN은 기본적으로 `my-wordloom.duckdns.org`가 됩니다. 처음부터 별도 보유 도메인을 사용한다면 해당 DNS를 서버에 연결하고 `.env`에 `DOMAIN=your-domain.example`을 추가할 수 있습니다. 도메인을 변경하면 인증서 재발급 및 브라우저 학습 기록 백업·복원도 필요합니다.

.env는 Git과 Docker 빌드 컨텍스트에서 제외됩니다. DuckDNS 토큰은 갱신기에만 전달하고 브라우저·앱 이미지에는 포함하지 않습니다.

## 3. 최초 실행 및 인증서 발급

```sh
docker compose config --quiet
docker compose build
docker compose up -d duckdns app
docker compose logs --tail=20 duckdns
```

`DuckDNS IPv4 update: OK`와 실제 DNS 반영을 확인합니다. 인증서 발급 전 HTTP의 앱 경로는 **503 준비 중** 응답입니다. `/.well-known/acme-challenge/` 경로는 이때도 인증 검증에 사용할 수 있습니다.

공유기 TCP 80 전달이 준비된 상태에서:

```sh
docker compose run --rm certbot --issue
```

이 명령은 설정한 이메일로 Let's Encrypt 계정을 등록하고 이용약관에 동의하는 옵션을 포함합니다. HTTP-01 검증을 통해 인증서를 `letsencrypt` Docker 볼륨에 저장합니다. 발급 실패 시 app/duckdns 로그, 공인 DNS, TCP 80 및 잘못된 AAAA를 확인한 후 재시도하세요. 원인이 해결되기 전에 반복 발급하지 마세요.

발급이 성공하면 **최대 약 60초 이내** Nginx가 인증서 생성을 감지하고 HTTPS로 전환합니다. 즉시 반영하려면:

```sh
docker compose exec app nginx -t
docker compose restart app
docker compose up -d certbot
docker compose ps
```

`nginx -t`는 현재 설정을 확인하며, 인증서 전환은 감지 루프 또는 재시작이 수행합니다. 이후 `https://my-wordloom.duckdns.org` 접속. HTTP는 HTTPS로 308 이동합니다. 앱에서 **오프라인 준비 완료**까지 기다리세요.

초기 인증서 발급 이후에는 다음 한 줄로 세 서비스를 시작·갱신할 수 있습니다:

```sh
docker compose up -d --build
```

## 4. 갱신과 확인

### 빌드 중 vocabulary checksum mismatch

이전 버전은 Windows의 CRLF 줄바꿈으로 계산한 해시를 저장해 Mac/Linux의 LF 체크아웃에서 검증이 실패할 수 있었습니다. 수정 버전은 13개 어휘 팩과 생성기의 출력을 LF로 고정합니다. 수정된 `data/packs/`, `data/catalog-manifest.json`, `.gitattributes`, `scripts/build-vocabulary.py`를 함께 반영한 후 `docker compose build`를 다시 실행하세요. `.env`를 다시 만들거나 Docker 볼륨을 삭제할 필요는 없습니다. 계속 실패하면 데이터 파일의 로컬 변경 또는 전송 누락을 확인하세요. 체크섬 검증을 끄거나 변경된 파일에 맞춰 해시만 재계산하지 마세요.

Certbot은 12시간마다 갱신을 검사하고, Nginx는 60초마다 인증서 변경을 감지해 `nginx -t` 통과 후 reload합니다. Docker 소켓을 컨테이너에 연결하지 않습니다. ACME 경로는 HTTPS 전환 후에도 HTTP에서 유지하므로 갱신을 위해 TCP 80을 계속 열어두세요.

```sh
# 인증서 목록
docker compose run --rm certbot certificates
# 실제 인증서를 바꾸지 않고 갱신 절차 점검
docker compose run --rm certbot renew --dry-run
# 로그
docker compose logs --tail=100 app duckdns certbot
```

아직 인증서가 없으면 `renew --dry-run`만으로 최초 발급 검증이 되지는 않습니다.

휴대폰 Wi-Fi를 끄고 이동통신망에서 외부 접속을 확인하세요:

```sh
curl -I http://my-wordloom.duckdns.org
curl -I https://my-wordloom.duckdns.org
curl -fsS https://my-wordloom.duckdns.org/data/catalog-manifest.json
curl -fsS https://my-wordloom.duckdns.org/data/packs/core-13.json
```

같은 집 Wi-Fi에서만 실패하면 공유기 NAT loopback 지원을 확인합니다. app healthcheck는 내부 HTTP 프로세스 상태만 검사하며 공개 DNS·TLS 인증서·외부 연결을 보장하지 않습니다. certbot 서비스가 단순히 running인 것만으로 최근 갱신 성공이 보장되지 않으므로 로그와 dry-run도 확인하세요.

## 5. 운영

- `letsencrypt`에 인증서·ACME 계정, `acme_webroot`에 인증 임시 파일을 보존합니다. 평소 중지는 `docker compose down`을 사용하고 `down -v`로 인증서를 삭제하지 마세요.
- 학습 기록은 맥미니가 아닌 각 브라우저의 IndexedDB에 저장됩니다. JSON 백업이 필요합니다.
- 앱 코드 갱신 시 서비스 워커 캐시 버전도 올리세요. 사용자 앱 탭을 모두 닫고 다시 열면 업데이트됩니다.
- 서버 잠자기를 방지하고 Docker Desktop 로그인 시 시작을 설정하세요. `restart: unless-stopped`는 Docker 엔진 실행 후에 적용됩니다.
- Caddy 구성에서 이전하는 경우 기존 앱 컨테이너를 먼저 내려 80/443 충돌을 피하세요. 기존 Caddy 인증서 볼륨은 이 Nginx 구성에서 사용하지 않습니다. 기존 볼륨을 삭제할 필요는 없습니다.

## 검증 범위

Compose 설정, POSIX 셸 문법, 모의 Certbot 발급 인자와 DuckDNS 처리 검사를 통과했습니다. Nginx 1.30.6 Windows 검증 바이너리에서 HTTP 준비 503, ACME 파일 제공, 로컬 테스트 인증서 HTTPS, HTTP→HTTPS 308, nginx reload, 13팩 6,500개 제공 및 없는 파일 404를 확인했습니다. 결과: `verification/nginx-deployment-checks.json`.

실행 중인 Docker 엔진·실제 도메인·Mac mini가 없어 Linux 이미지 빌드/컨테이너 실행 및 공개 인증서 발급·갱신은 직접 검증하지 않았습니다. 로컬 테스트 인증서는 공개 배포용 이미지에 포함되지 않습니다.

공식 참고: [Nginx 이미지](https://hub.docker.com/_/nginx), [Certbot webroot/renew](https://eff-certbot.readthedocs.io/en/stable/using.html), [DuckDNS API](https://www.duckdns.org/spec.jsp).
