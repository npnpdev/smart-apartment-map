FROM python:3.12-slim
WORKDIR /work

# Kopiujemy z folderu docs do środka kontenera
COPY docs/requirements-docs.txt .

RUN pip install -r requirements-docs.txt
