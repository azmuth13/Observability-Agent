"""Kafka consumer that stores a recent rolling window of live logs."""

from __future__ import annotations

import logging

from backend.config import get_settings
from backend.live_logs.store import LiveLogStore, parse_kafka_log_event

try:
    from kafka import KafkaConsumer
except ImportError:  # pragma: no cover
    KafkaConsumer = None


logger = logging.getLogger(__name__)


def consume_kafka_logs() -> None:
    """Consume structured JSON logs from Kafka into the local recent-log store."""
    settings = get_settings()
    if KafkaConsumer is None:
        raise RuntimeError(
            "Install `kafka-python` to run the live log consumer."
        )

    store = LiveLogStore()
    consumer = KafkaConsumer(
        settings.kafka_logs_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_group_id,
        auto_offset_reset="latest",
        enable_auto_commit=True,
        value_deserializer=lambda value: value.decode("utf-8"),
    )

    logger.info(
        "starting kafka log consumer",
        extra={
            "topic": settings.kafka_logs_topic,
            "bootstrap_servers": settings.kafka_bootstrap_servers,
            "group_id": settings.kafka_group_id,
        },
    )

    for message in consumer:
        event = parse_kafka_log_event(message.value)
        store.append(event)


if __name__ == "__main__":  # pragma: no cover
    consume_kafka_logs()
