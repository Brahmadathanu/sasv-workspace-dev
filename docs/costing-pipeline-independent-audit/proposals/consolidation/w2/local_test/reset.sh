#!/bin/bash
psql -h /tmp -p 55439 -U postgres -d postgres -X -q -c "drop database if exists w2" -c "create database w2" -c "alter database w2 set timezone to 'UTC'" && pg_restore -h /tmp -p 55439 -U postgres -d w2 /workspace/w2/fixture_w2.dump
