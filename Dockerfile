FROM python:3.12-slim AS dev
WORKDIR /work
COPY requirements-docs.txt .
RUN pip install -r requirements-docs.txt
