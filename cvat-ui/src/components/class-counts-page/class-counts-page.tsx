// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, { useEffect, useReducer } from 'react';
import { useHistory, useParams } from 'react-router';
import Empty from 'antd/lib/empty';
import Input from 'antd/lib/input';
import Result from 'antd/lib/result';
import Title from 'antd/lib/typography/Title';
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { getCore } from 'cvat-core-wrapper';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import GoBackButton from 'components/common/go-back-button';
import { ActionUnion, createAction } from 'utils/redux';

// chart.js does not register anything by default
Chart.register(...registerables);

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

function ClassCountsChart({ counts }: { counts: ClassCountRow[] }): JSX.Element {
    return (
        <div
            className='cvat-class-counts-chart-wrapper'
            style={{ height: Math.max(counts.length * 28, 400) }}
        >
            <Bar
                data={{
                    labels: counts.map((row) => row.label),
                    datasets: [{
                        label: 'Shapes',
                        data: counts.map((row) => row.count),
                        backgroundColor: 'rgba(24, 144, 255, 0.7)',
                    }],
                }}
                options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                    },
                }}
            />
        </div>
    );
}

export default function ClassCountsPage(): JSX.Element {
    const { tid } = useParams<{ tid: string }>();
    const history = useHistory();
    const [state, dispatch] = useReducer(
        reducer, { fetching: false, counts: [], error: null },
    );
    const taskId = Number(tid);

    useEffect(() => {
        if (!Number.isInteger(taskId)) {
            return undefined;
        }

        dispatch(reducerActions.fetch());
        core.test.getTaskClassCounts(taskId).then((counts) => {
            dispatch(reducerActions.fetchSuccess(counts));
        }).catch((error: Error) => {
            dispatch(reducerActions.fetchFailed(error));
        });

        return undefined;
    }, [taskId]);

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
            </div>
            {state.counts.length ? (
                <ClassCountsChart counts={state.counts} />
            ) : (
                <Empty description='No annotations in this task' />
            )}
        </div>
    );
}
