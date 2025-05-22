from django.shortcuts import render
from django.db import models
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import File
from .serializers import FileSerializer
import hashlib

# Create your views here.

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate hash
        hasher = hashlib.sha256()
        for chunk in file_obj.chunks():
            hasher.update(chunk)
        file_hash = hasher.hexdigest()
        file_obj.seek(0)

        # Check for duplicate
        try:
            existing_file = File.objects.get(hash=file_hash)
            # If a file with the same hash exists, return a 400 error with a clear message
            return Response(
                {
                    'duplicate': True,
                    'message': 'File is already uploaded.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except File.DoesNotExist:
            # Not a duplicate, proceed as normal
            data = {
                'file': file_obj,
                'original_filename': file_obj.name,
                'file_type': file_obj.content_type,
                'size': file_obj.size,
                'hash': file_hash
            }
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def storage_savings(self, request):
        total_uploaded = File.objects.all().aggregate(total=models.Sum('size'))['total'] or 0
        unique_hashes = File.objects.values('hash').distinct()
        unique_files = File.objects.filter(hash__in=[u['hash'] for u in unique_hashes])
        actual_storage = unique_files.aggregate(total=models.Sum('size'))['total'] or 0
        savings = total_uploaded - actual_storage
        return Response({
            'total_uploaded_bytes': total_uploaded,
            'actual_storage_bytes': actual_storage,
            'savings_bytes': savings
        })
