# Configuração nginx para mitigar erro HTTP/2

## Opção 1: Desabilitar HTTP/2 (mais seguro)
```nginx
server {
    listen 443 ssl;
    # Remover 'http2' da diretiva listen
    
    # ... resto da configuração
}
```

## Opção 2: Aumentar buffers HTTP/2
```nginx
server {
    listen 443 ssl http2;
    
    # Aumentar buffers HTTP/2
    http2_body_preread_size 64k;
    http2_chunk_size 8k;
    
    # Aumentar timeouts
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 300s;
    
    # ... resto da configuração
}
```

## Opção 3: Configuração completa recomendada
```nginx
upstream backend {
    server localhost:8080;
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name chatsapi.nobreluminarias.com.br;
    
    # SSL
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Timeouts
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 300s;
    
    # Buffers
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    
    # Headers
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
    }
}
```

## Deploy do Frontend

O frontend atualizado precisa ser deployado:

```bash
cd frontend
npm run build
# Copiar pasta 'build' para o servidor web
```

Ou se usar docker:
```bash
docker-compose up -d --build frontend
```
