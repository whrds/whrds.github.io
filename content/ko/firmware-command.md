---
title: "[FIRMWARE] Command"
description: "펌웨어 분석을 시도할 때 자주 사용하는 명령을 메모해두고자 한다. 분석하는 사람마다 스타일이 다르기 때문에 그냥 참고용으로 이 사람은 이런 명령들을 주로 사용하는 구나 하고 보면 된다. binwalk펌웨어를 한번이라도 본 사람들은 누구나 다뤄보았을 툴이다.펌웨어를 구성하고 있는 세부 요소들을 시그니처 단위로 분석하여 보여"
date: "2025-08-25"
translation_key: "tistory-058612323cbb"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-Command"
private: false
---

펌웨어 분석을 시도할 때 자주 사용하는 명령을 메모해두고자 한다.

분석하는 사람마다 스타일이 다르기 때문에 그냥 참고용으로 이 사람은 이런 명령들을 주로 사용하는 구나 하고 보면 된다.

### binwalk

펌웨어를 한번이라도 본 사람들은 누구나 다뤄보았을 툴이다.

펌웨어를 구성하고 있는 세부 요소들을 시그니처 단위로 분석하여 보여준다.

![](/assets/images/tistory/tistory-058612323cbb/001.png)

함께 사용하는 옵션으로는 -eM이 있다

```
binwalk -eM {firmware}
```

\-e : 알려진 파일 형식으로 자동 추출

\-M : 추출된 파일들을 재귀적으로 검색

이 2가지 옵션을 함께 사용하면 펌웨어에서 1차 추출을 하고, 내부에 나온 파일을 또 타고 들어가서 다시 검사 수행 후 추출한다.

다시 말해 파일을 더 이상 추출할 파일이 없을 때까지 파고 들어가서 추출하는 것이기 때문에 함께 사용한다.

### dd

data description의 약자로 말 그대로 펌웨어나 디스크 등으로부터 데이터를 복사할 때 사용하는 명령이다.

저수준 데이터 복사 및 변환 명령이지만 펌웨어에서 필요한 명령을 추출할 수 있기에 많이 사용하는 편이다.

```
dd if={firmware_name} of={output_file} bs=1 skip={start_offset} count={data_size}
```

![](/assets/images/tistory/tistory-058612323cbb/002.png)

위 그림을 보면 크기 데이터를 $(( ~~~ ))으로 묶고 있다.

원래는 skip에서처럼 10진수 숫자 값이 들어가야 하기 때문에 데이터 크기를 직접 계산하고 넣어줘야 하지만 일일이 하기에는 귀찮기 때문에 저렇게 사용하여 자동 계산이 수행되게 한다.

### xxd

파일의 HEX 값을 볼 수 있게 해주는 명령이다.

보통 head | more | tail 명령과 함께 사용한다.

![](/assets/images/tistory/tistory-058612323cbb/003.png)

일반적인 WSL 환경이라면 010 Editor나 HxD 를 사용하여 보겠다만 개인 서버를 사용하는 입장으로서 할 때마다 다운받고 , 수정하고 업로드하는 과정이 귀찮기 때문에 많이 사용한다.

좀 더 상세한 분석을 위해서는 > output.txt 명령을 통해 저장하여 보곤 한다.

```
xxd {firmware} 
xxd {firmware} | head
xxd {firmware} | more
xxd {firmware} | tail
xxd {firmware} > output.txt
xxd {firmware} | grep "~~"
```

### file

파일이 어떤 파일인지 알려주는 명령이다.

binwalk나 dd 명령을 통해 추출한 파일을 확인할 때 주로 사용한다.

![](/assets/images/tistory/tistory-058612323cbb/004.png)

### grep

파일에서 특정 문자열/키워드를 탐색할 때 주로 사용한다.

\-rn 옵션을 붙여서 전체 탐색 용으로 사용한다.

```
grep -rn "~~"
```

![](/assets/images/tistory/tistory-058612323cbb/005.png)

\-r : 지정된 디렉터리 및으로 재귀적으로 탐색 수행

\-n : 탐색으로 찾은 문자열이 어느 파일의 몇번째 줄에 있는지 보여줌

### find

특정 파일을 탐색할 때 주로 사용한다.

```
find ./ -name "*cgi*"
```

### mount / umount

펌웨어 파일을 마우트 하여 분석할 때 주로 사용하는 방법이다.

사용 이미지랑은 이전 게시글들에 있으므로 패스

```
sudo mount -t {cramfs,squafs ...} -o loop,ro {firmware} {mnt}

sudo umount {mnt}
```
