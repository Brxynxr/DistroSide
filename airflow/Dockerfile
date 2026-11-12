FROM apache/airflow:2.9.2

USER airflow
COPY airflow/requirements.txt /requirements.txt
RUN pip install --no-cache-dir \
    --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.9.2/constraints-3.12.txt" \
    -r /requirements.txt
