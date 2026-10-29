# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers

from cvat.apps.engine.models import ShapeType


class ClassCountSerializer(serializers.Serializer):
    label = serializers.CharField(source="label__name")
    type = serializers.ChoiceField(choices=ShapeType.choices(), required=False)
    count = serializers.IntegerField()


class ClassCountsQuerySerializer(serializers.Serializer):
    group_by = serializers.ChoiceField(choices=("shape_type",), required=False)
