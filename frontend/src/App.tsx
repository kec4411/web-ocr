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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { requestOcr, toErrorMessage } from './api/ocr';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const baseStyle = {
  height: '80%',
  transition: '0.2s ease-in-out',
  borderRadius: '10px',
} as const;

const borderNormalStyle = { border: '3px dotted var(--chakra-colors-gray-300)' } as const;
const borderDragStyle = { border: '5px solid var(--chakra-colors-teal-300)' } as const;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

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
    accept: { 'image/*': [] },
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
      <Grid h="600px" templateRows="repeat(3, 1fr)" templateColumns="repeat(7, 1fr)" gap={4}>
        <GridItem rowSpan={1} colSpan={7}>
          <Center h="100%">
            <Box {...getRootProps({ style })}>
              <Center h="100%">
                <input {...getInputProps()} />
                <Text>
                  ここにファイルをドラッグ＆ドロップするか、
                  <Link color="teal.500" onClick={open}>
                    ファイルを選択
                  </Link>
                  してください。
                </Text>
              </Center>
            </Box>
          </Center>
        </GridItem>

        <GridItem rowSpan={2} colSpan={3}>
          <Heading fontSize="md">・画像プレビュー</Heading>
          <Center h="100%">
            <Box
              w="95%"
              h="95%"
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
          </Center>
        </GridItem>

        <GridItem rowSpan={2} colSpan={1}>
          <Center h="100%">
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

        <GridItem rowSpan={2} colSpan={3}>
          <Heading fontSize="md">・読み取り結果</Heading>
          <Box
            w="95%"
            h="95%"
            bg="white"
            border="1px"
            borderColor="gray.200"
            borderRadius="10"
            boxShadow="xl"
          >
            <Editable
              value={ocrText}
              onChange={setOcrText}
              placeholder="ここに読み取り結果が表示されます。"
              h="100%"
              whiteSpace="pre-wrap"
            >
              <EditablePreview h="100%" />
              <EditableTextarea h="100%" aria-label="読み取り結果" />
            </Editable>
          </Box>
        </GridItem>
      </Grid>
    </ChakraProvider>
  );
}

export default App;
