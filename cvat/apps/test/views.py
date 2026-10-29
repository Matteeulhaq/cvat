# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from cvat.apps.engine.models import LabeledShape, Task
from cvat.apps.engine.permissions import TaskPermission

from . import serializers


class ClassCountsViewSet(viewsets.GenericViewSet):
    queryset = Task.objects.all()
    serializer_class = serializers.ClassCountSerializer
    filter_backends = ()
    pagination_class = None
    iam_permission_class = TaskPermission

    @extend_schema(
        tags=["test"],
        summary="Return the number of labeled shapes for each label of the task",
        parameters=[
            OpenApiParameter(
                "group_by",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.STR,
                enum=["shape_type"],
                required=False,
                description="Additionally group the counts by shape type",
            ),
        ],
        responses={200: serializers.ClassCountSerializer(many=True)},
    )
    @action(detail=True, methods=["GET"], url_path="class-counts")
    def class_counts(self, request, pk):
        # get_object() performs the object-level permission check
        self.get_object()

        query = serializers.ClassCountsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)

        values = ["label__name"]
        if query.validated_data.get("group_by") == "shape_type":
            values.append("type")

        rows = (
            LabeledShape.objects.filter(job__segment__task_id=self.kwargs["pk"])
            .values(*values)
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        return Response(serializers.ClassCountSerializer(rows, many=True).data)
