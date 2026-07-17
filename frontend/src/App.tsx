import {
  Box,
  Button,
  Center,
  ChakraProvider,
  Editable,
  EditablePreview,
  EditableTextarea,
  Grid,
  GridItem,
  Heading,
  Image,
  Link,
  Text,
  theme,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { requestOcr, toErrorMessage } from './api/ocr';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Minimum height of the preview / result panels. Short results still read as a
// card; the result panel grows past this as the text gets longer.
const PANEL_MIN_H = '340px';

// Mirrors ALLOWED_CONTENT_TYPES in backend/app/config.py. Kept narrow rather
// than `image/*` so an unsupported format (e.g. HEIC) is rejected in the
// browser instead of making a round trip to be told 415.
const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': [],
  'image/png': [],
  'image/gif': [],
  'image/bmp': [],
  'image/tiff': [],
  'image/webp': [],
} as const;

const baseStyle = {
  transition: '0.2s ease-in-out',
  borderRadius: '10px',
  padding: '44px 24px',
} as const;

const borderNormalStyle = { border: '3px dotted var(--chakra-colors-gray-300)' } as const;
const borderDragStyle = { border: '5px solid var(--chakra-colors-teal-300)' } as const;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the edit-mode textarea to fit its content. The view-mode preview
  // (EditablePreview) is a block element and grows on its own.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const dropped = acceptedFiles[0];
    if (!dropped) return;
    setFile(dropped);
    setFileUrl(URL.createObjectURL(dropped));
  }, []);

  // The preview URL holds a reference to the file until it is revoked.
  useEffect(() => {
    if (!fileUrl) return;
    return () => URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const { getRootProps, getInputProps, isDragActive, open, fileRejections } = useDropzone({
    onDrop,
    noClick: true,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
  });

  useEffect(() => {
    if (fileRejections.length === 0) return;
    toast({
      title: 'このファイルは読み込めません',
      description: '10MB 以下の画像ファイルを 1 つだけ選択してください。',
      status: 'warning',
      duration: 5000,
      isClosable: true,
    });
  }, [fileRejections, toast]);

  const style = useMemo(
    () => ({ ...baseStyle, ...(isDragActive ? borderDragStyle : borderNormalStyle) }),
    [isDragActive],
  );

  const postImage = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      setOcrText(await requestOcr(file));
    } catch (error) {
      // The backend's detail used to be swallowed by console.log, leaving the
      // user unable to tell an error from an image with no text in it.
      toast({
        title: '読み取りに失敗しました',
        description: toErrorMessage(error),
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChakraProvider theme={theme}>
      <Heading bg="green.700" color="white" p="2">
        WEB OCR
      </Heading>

      <Box p={4}>
        <Center mb={6}>
          <Box {...getRootProps({ style })} w="80%" maxW="640px">
            <input {...getInputProps()} />
            <Text textAlign="center">
              ここにファイルをドラッグ＆ドロップするか、
              <Link color="teal.500" onClick={open}>
                ファイルを選択
              </Link>
              してください。
            </Text>
          </Box>
        </Center>

        <Grid templateColumns="repeat(7, 1fr)" gap={4} alignItems="start">
          <GridItem colSpan={3}>
            <Heading fontSize="md" mb={2}>
              ・画像プレビュー
            </Heading>
            <Box
              h={PANEL_MIN_H}
              bg="white"
              border="1px"
              borderColor="gray.200"
              borderRadius="10"
              boxShadow="xl"
            >
              <Center h="100%">
                {fileUrl && (
                  <Image
                    src={fileUrl}
                    alt={`選択した画像のプレビュー: ${file?.name ?? ''}`}
                    maxW="90%"
                    maxH="90%"
                    objectFit="contain"
                  />
                )}
              </Center>
            </Box>
          </GridItem>

          <GridItem colSpan={1}>
            {/* Hidden heading reserves the same height as the real ones, so the
                button band lines up with the panels below their headings. */}
            <Heading fontSize="md" mb={2} aria-hidden="true" visibility="hidden">
              ・
            </Heading>
            <Center h={PANEL_MIN_H}>
              <Button
                type="button"
                colorScheme="green"
                onClick={postImage}
                isLoading={isLoading}
                loadingText="読み取り中"
                isDisabled={!file}
                spinnerPlacement="start"
                boxShadow="xl"
              >
                読み取り開始
              </Button>
            </Center>
          </GridItem>

          <GridItem colSpan={3}>
            <Heading fontSize="md" mb={2}>
              ・読み取り結果
            </Heading>
            <Box
              minH={PANEL_MIN_H}
              bg="white"
              border="1px"
              borderColor="gray.200"
              borderRadius="10"
              boxShadow="xl"
              p={2}
            >
              <Editable
                value={ocrText}
                onChange={(value) => {
                  setOcrText(value);
                  requestAnimationFrame(autoResize);
                }}
                onEdit={() => requestAnimationFrame(autoResize)}
                placeholder="ここに読み取り結果が表示されます。"
                whiteSpace="pre-wrap"
                w="100%"
              >
                <EditablePreview w="100%" />
                <EditableTextarea
                  ref={textareaRef}
                  aria-label="読み取り結果"
                  resize="none"
                  overflow="hidden"
                />
              </Editable>
            </Box>
          </GridItem>
        </Grid>
      </Box>
    </ChakraProvider>
  );
}

export default App;
