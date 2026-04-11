from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime


def hello_world():
    print("Будем прогнозировать комиссии Ethereum")


with DAG(
    dag_id="test_dag_simple",
    start_date=datetime(2024, 1, 1),
    schedule="@daily",  # можно None для ручного запуска
    catchup=False,
    tags=["test"],
) as dag:

    task_hello = PythonOperator(
        task_id="first_task",
        python_callable=hello_world,
    )

    task_hello
