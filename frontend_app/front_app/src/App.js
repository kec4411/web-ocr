import { useState, useCallback, useMemo } from "react";
import {
  ChakraProvider,
  Heading,
  Button,
  Box,
  Text,
  Link,
  Grid,
  GridItem,
  Editable,
  EditableTextarea,
  EditablePreview,
  theme,
  Center,
  Image
} from '@chakra-ui/react';

import axios from "axios";
import { useDropzone } from "react-dropzone";

const baseStyle = {
  height: '80%',
  transition: '0.2s ease-in-out'
};

const borderNormalStyle = {
  border: '3px',
  borderStyle: 'dotted',
  borderColor: 'gray',
};
const borderDragStyle = {
  border: '5px',
  borderStyle: 'solid',
  borderColor: 'pink',
};

function App() {
  const [fileUrl, setFileUrl] = useState();
  const [ocrText, setOcrText] = useState();
  const [ isLoading, setIsLoading ] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    console.log("acceptedFiles:", acceptedFiles);
    if (acceptedFiles.length > 0) {
      const src = URL.createObjectURL(acceptedFiles[0]);
      setFileUrl(src);
      // setUploadFile(acceptedFiles[0]);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open,
    acceptedFiles
  } = useDropzone({
    onDrop,
    noClick: true
  });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isDragActive ? borderDragStyle : borderNormalStyle)
    }),
    [isDragActive]
  );

  const postImage = async () => {
    setIsLoading(true);
    const url = "http://localhost:9004/convert/";
    const data = new FormData();
    data.append('file', acceptedFiles[0]);
    const headers = { "content-type": "multipart/form-data" };
    axios
      .post( url, data, { headers })
      .then((res) => {
        console.log(res.data.ocrresult);
        setOcrText(res.data.ocrresult);
        setIsLoading(false);
      })
      .catch(err =>{
        console.log(err);
        setIsLoading(false);
      } );
    }

  return (
    <ChakraProvider theme={theme}>
      <Heading bg='green.700' color='white'>WEB OCR</Heading>
      <Grid
        h='600px'
        templateRows='repeat(3, 1fr)'
        templateColumns='repeat(7, 1fr)'
        gap={4}
      >
        <GridItem rowSpan={1} colSpan={7}>
          <Center h='100%'>
            <Box {...getRootProps({ style })} borderRadius='10'>
              <Center>
                <input {...getInputProps()} />
                  <Text>ここにファイルをドラッグ＆ドロップするか、
                    <Link color='teal.500' onClick={open}>ファイルを選択</Link>
                    してください。
                  </Text>
              </Center>
            </Box>
          </Center>
        </GridItem>

        <GridItem rowSpan={2} colSpan={3}>
          <Heading fontSize='md'>・画像プレビュー</Heading>
            <Center h='100%'>
              <Box w='95%' h='95%' bg='white' border='1px' borderColor='lightgray' borderRadius='10' boxShadow='xl'>
                <Center h='100%'>
                  <Image src={fileUrl} alt="" width="90%" margin='auto' />
                </Center>
              </Box>
            </Center>
        </GridItem>

        <GridItem rowSpan={2} colSpan={1} >
          <Center h='100%'>
            { isLoading ?
              <Button
                isLoading
                loadingText='読み取り中'
                colorScheme='teal'
                variant='outline'
                spinnerPlacement='start'
                boxShadow='xl'
              />
              :
              <Button
                type="button"
                colorScheme="green"
                onClick={postImage}
                className="btn btn-primary align-self-center"
                boxShadow='xl'
                >
                読み取り開始
              </Button>
            }
          </Center>
        </GridItem>
        
        <GridItem rowSpan={2} colSpan={3}>
          <Heading fontSize='md'>・読み取り結果</Heading>
            <Box w='95%' h='95%' bg='white' border='1px' borderColor='lightgray' borderRadius='10' boxShadow='xl'>
              <Editable value={ocrText} h='100%' whiteSpace='pre-wrap'>
                <EditablePreview h='100%'/>
                <EditableTextarea h='100%'/>
              </Editable>
            </Box>
        </GridItem>
      </Grid>
    </ChakraProvider>
  );
}

export default App;
