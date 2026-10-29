# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import routers

from .views import ClassCountsViewSet

router = routers.DefaultRouter(trailing_slash=False)
router.register("test/tasks", ClassCountsViewSet, basename="test_task")

urlpatterns = router.urls
