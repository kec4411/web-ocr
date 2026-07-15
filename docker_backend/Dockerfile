FROM centos/python-36-centos7:latest
USER root

RUN yum update -y
RUN yum install -y epel-release

# TesseractOCR に必要なパッケージをインストール
RUN yum install -y tesseract tesseract-langpack-jpn.noarch leptonica

# OpenCV に必要なパッケージをインストール
RUN yum install -y opencv opencv-devel opencv-python

ENV PYTHONUNBUFFERED 1
RUN mkdir /app
WORKDIR /app
ADD requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
# ADD . /app/