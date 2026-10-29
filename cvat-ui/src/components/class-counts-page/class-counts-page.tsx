// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, {
    useEffect, useMemo, useReducer, useState,
} from 'react';
import { useHistory, useParams } from 'react-router';
import Empty from 'antd/lib/empty';
import Input from 'antd/lib/input';
import Result from 'antd/lib/result';
import Select from 'antd/lib/select';
import Title from 'antd/lib/typography/Title';
import {
    Chart, ChartData, registerables,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { getCore } from 'cvat-core-wrapper';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import GoBackButton from 'components/common/go-back-button';
import { ActionUnion, createAction } from 'utils/redux';

// chart.js does not register anything by default
Chart.register(...registerables);

const SHAPE_TYPE_COLORS = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
];

type GroupBy = 'none' | 'shape_type';

interface ClassCountRow {
    label: string;
    type?: string;
    count: number;
}

interface State {
    fetching: boolean;
    counts: ClassCountRow[];
    error: Error | null;
}

enum ReducerActionType {
    FETCH = 'FETCH',
    FETCH_SUCCESS = 'FETCH_SUCCESS',
    FETCH_FAILED = 'FETCH_FAILED',
}

const reducerActions = {
    fetch: () => createAction(ReducerActionType.FETCH, {}),
    fetchSuccess: (counts: ClassCountRow[]) => (
        createAction(ReducerActionType.FETCH_SUCCESS, { counts })
    ),
    fetchFailed: (error: Error) => (
        createAction(ReducerActionType.FETCH_FAILED, { error })
    ),
};

const reducer = (state: State, action: ActionUnion<typeof reducerActions>): State => {
    if (action.type === ReducerActionType.FETCH) {
        return { ...state, fetching: true, error: null };
    }

    if (action.type === ReducerActionType.FETCH_SUCCESS) {
        return { ...state, fetching: false, counts: action.payload.counts };
    }

    if (action.type === ReducerActionType.FETCH_FAILED) {
        return { ...state, fetching: false, error: action.payload.error };
    }

    return state;
};

const core = getCore();

function buildChartData(counts: ClassCountRow[], grouped: boolean): ChartData<'bar', number[], string> {
    if (!grouped) {
        return {
            labels: counts.map((row) => row.label),
            datasets: [{
                label: 'Shapes',
                data: counts.map((row) => row.count),
                backgroundColor: SHAPE_TYPE_COLORS[0],
            }],
        };
    }

    const totals = new Map<string, number>();
    const countsByLabel = new Map<string, Map<string, number>>();
    for (const row of counts) {
        const shapeType = row.type ?? 'unknown';
        if (!countsByLabel.has(row.label)) {
            countsByLabel.set(row.label, new Map());
        }
        countsByLabel.get(row.label)?.set(shapeType, row.count);
        totals.set(row.label, (totals.get(row.label) ?? 0) + row.count);
    }

    // keep the labels ordered by their total count, like the plain view does
    const labels = [...totals.entries()]
        .sort((first, second) => second[1] - first[1])
        .map(([label]) => label);
    const shapeTypes = [...new Set(counts.map((row) => row.type ?? 'unknown'))];

    return {
        labels,
        datasets: shapeTypes.map((shapeType, index) => ({
            label: shapeType,
            data: labels.map((label) => countsByLabel.get(label)?.get(shapeType) ?? 0),
            backgroundColor: SHAPE_TYPE_COLORS[index % SHAPE_TYPE_COLORS.length],
        })),
    };
}

interface ClassCountsChartProps {
    counts: ClassCountRow[];
    grouped: boolean;
}

function ClassCountsChart({ counts, grouped }: ClassCountsChartProps): JSX.Element {
    const data = useMemo(() => buildChartData(counts, grouped), [counts, grouped]);
    const barCount = data.labels?.length ?? 0;

    return (
        <div
            className='cvat-class-counts-chart-wrapper'
            style={{ height: Math.max(barCount * 28, 400) }}
        >
            <Bar
                data={data}
                options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: grouped ? { position: 'bottom' } : { display: false },
                    },
                    scales: grouped ? { x: { stacked: true } } : undefined,
                }}
            />
        </div>
    );
}

export default function ClassCountsPage(): JSX.Element {
    const { tid } = useParams<{ tid: string }>();
    const history = useHistory();
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [state, dispatch] = useReducer(
        reducer, { fetching: false, counts: [], error: null },
    );
    const taskId = Number(tid);

    useEffect(() => {
        if (!Number.isInteger(taskId)) {
            return undefined;
        }

        dispatch(reducerActions.fetch());
        core.test.getTaskClassCounts(taskId, groupBy === 'shape_type' ? groupBy : undefined)
            .then((counts) => {
                dispatch(reducerActions.fetchSuccess(counts));
            })
            .catch((error: Error) => {
                dispatch(reducerActions.fetchFailed(error));
            });

        return undefined;
    }, [taskId, groupBy]);

    const onSearch = (value: string): void => {
        const parsedId = Number(value);
        if (Number.isInteger(parsedId)) {
            history.push(`/tasks/${parsedId}/class-counts`);
        }
    };

    if (!Number.isInteger(taskId)) {
        // there is no task id in the URL, let the user pick a task
        return (
            <div className='cvat-class-counts-page'>
                <div className='cvat-class-counts-page-header'>
                    <Title level={4} className='cvat-text-color'>Annotation class counts</Title>
                </div>
                <div className='cvat-class-counts-task-picker'>
                    <Input.Search
                        size='large'
                        placeholder='Enter a task ID'
                        enterButton='Show counts'
                        onSearch={onSearch}
                    />
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className='cvat-class-counts-page'>
                <div className='cvat-class-counts-page-error'>
                    <Result
                        status='error'
                        title='Could not open the page'
                        subTitle={state.error.message}
                        extra={<GoBackButton />}
                    />
                </div>
            </div>
        );
    }

    if (state.fetching) {
        return (
            <div className='cvat-class-counts-page'>
                <div className='cvat-class-counts-page-loading'>
                    <CVATLoadingSpinner />
                </div>
            </div>
        );
    }

    return (
        <div className='cvat-class-counts-page'>
            <div className='cvat-class-counts-page-header'>
                <Title level={4} className='cvat-text-color'>
                    {`Annotation class counts for task ${taskId}`}
                </Title>
                <Select<GroupBy>
                    className='cvat-class-counts-group-by-select'
                    value={groupBy}
                    onChange={(value: GroupBy) => setGroupBy(value)}
                    options={[
                        { value: 'none', label: 'Total per class' },
                        { value: 'shape_type', label: 'Break down by shape type' },
                    ]}
                />
            </div>
            {state.counts.length ? (
                <ClassCountsChart counts={state.counts} grouped={groupBy === 'shape_type'} />
            ) : (
                <Empty description='No annotations in this task' />
            )}
        </div>
    );
}
