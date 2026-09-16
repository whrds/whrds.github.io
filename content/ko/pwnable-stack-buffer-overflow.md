---
title: "[PWNABLE]Stack Buffer OverFlow"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Buffer OverFlow는 발생하는 영역에 따라서 Stack Buffer OverFlow와 Heap Buffer OverFlow로 나뉜다.Heap에 대해서는 다음에 다룰 예정이기 때문에 Stack Buffer OverFlow만 작성하도록 하겠다."
date: "2023-09-06"
translation_key: "tistory-bc8b2be0d67f"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLEStack-Buffer-OverFlow"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※**   
   
**Buffer OverFlow**는 발생하는 영역에 따라서 Stack Buffer OverFlow와 Heap Buffer OverFlow로 나뉜다.  
Heap에 대해서는 다음에 다룰 예정이기 때문에 Stack Buffer OverFlow만 작성하도록 하겠다.  
   
먼저 Buffer라는 개념을 알아야 한다.  
Buffer는 컴퓨터가 데이터를 처리하기 위해 사용하는 것으로  단순하게 생각하면 데이터의 임시 저장소이다.   
예를 들면 12345라는 데이터를 송수신하는 것이 있다. 수신 측에서는 데이터를 받자마자 처리를 하게 되는데 임시 저장소가 없다면 처리하는 동안 수신받는 데이터들은 유실되게 될 것이다.   
즉 12345라는 데이터가 아닌 123의 데이터만 수신하는 상황이 발생한다.  
   
이런 **Buffer**는 Stack에서 지역 변수 혹은 매개 변수들의 저장소로 사용되게 된다.  
A와 B라는 변수가 있을 때, 우리가 사용하는 고급언어로 볼 때에는 2개의 변수는 따로 정의되었기 때문에 Buffer 역시 다른 공간에 존재한다라고 생각할 수도 있다.  
이제 이 관점을 컴퓨터의 관점에서 확인해 보겠다. 컴퓨터에서 돌아가는 프로그램들이 Stack을 사용할 때에 연속된 메모리 공간을 활용하게 된다. 때문에 우리가 서로 다른 변수들을 정의해도 같은 영역에 있다고 하면 변수들의 Buffer는 연속적으로 붙어있다.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/001.png)

* * *

### **Stack Buffer OverFlow 예제**

```
#include <stdio.h>

int main(){
	char name[10]="Whrd";
	char buf[0x50];
	
	printf("Hello! %s!!\n",name);
	printf("Where are you from?\n");
	read(0,buf,0x100);
	
	printf("Bye! %s\n",name);

	return 0;
}
```

위 코드는 단순히 사용자에게 인사를 하고, 어디서 왔는지 묻는 기능만 가지고 있다.  
  
코드를 보면 어느 정도 눈치를 챘을 수도 있지만 코드 상에 BOF취약점이 존재한다.

```
char name[10]="Whrd";
char buf[0x50];
read(0,buf,0x100);
```

buf라는 문자열의 크기는 0x50인데 read()를 이용하여 0x100만큼 입력받는 것을 볼 수 있다.  
이 전 게시글에서 Stack Frame에 대해 간략하게 작성을 해두었다.  
[(](https://whrdud727.tistory.com/category/STUDY/PWNABLE)[https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)](https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)

 [\[LINUX\] 메모리 구조

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 리눅스의 메모리 구조는 \[CODE 세그먼트\], \[DATA 세그먼트\], \[BSS 세그먼트\], \[HEAP 세그먼트\], \[STACK 세그먼트\]로 구성되어 있

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)

Stack Frame은 지역 변수와 매개 변수도 가지지만 이전 함수의 rbp를 저장하는 sfp와 복귀 주소인 ret를 가지고 있다.  
   
ret를 덮어씌운다면 Return Address OverFlow가 되지만 Stack부터 천천히 작성해 보겠다.  
위 코드에서 우리의 목표는 name이라는 문자열 안에 들어있는 'Whrd'를 다른 문자열로 바꾸는 것을 해보겠다.  
덮어씌우기 위해서는 먼저 Stack상에서 변수들의 위치를 확인해야 한다.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/002.png)

우선 할당된 크기를 보면 0x60이다.  
   
Stack을 보면서 각 변수들을 찾을 수도 있겠지만 printf(), read() 등등의 함수가 호출될 때 각 변수들을 인자로 사용한다.  
이 점을 활용하면 쉽게 변수들의 위치를 알아낼 수 있다.

![](/assets/images/tistory/tistory-bc8b2be0d67f/003.png)

printf()의 인자로는 name변수와 "Hello! % s!!"이라는 문자열이다.   
위 어셈블리어 코드를 가지고 보면 printf(\[rip+0 xe66\] , \[rbp-0xa\]이기 때문에 name 문자열은 \[rbp-0xa\]인 것을 알 수 있다.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/004.png)

같은 방법으로 read()를 보면 \[rbp-0x60\]이 buf인 것을 알 수 있다.  
코드에서 보면 \[rbp-0x60\]이 먼저 불려 왔기 때문에 3번째 인자인 거 아니냐고 생각할 수 있겠지만 코드를 자세히 보면 \[rbp-0x60\]을 rax 레지스터에 불려 오고 2번째 인자로 전달하게 된다.   
즉, read()의 2번째 인자였던 buf가 \[rbp-0x60\]인 것이다.  
   
지금까지 알아낸 것을 표로 그리면 다음과 같다.

buf \[rbp-0x60\]

dummy \[rbp-0x50\]

name \[rbp-0xa\]

sfp

ret

   
우리의 목표는 앞서 말했듯이 name문자열을 덮어 씌우는 것이므로 0x56만큼의 dummy를 입력하고 name에다가 변조하고자 하는 값을 입력하면 공격이 가능할 것이다.  
   
공격하기 전에 Stack의 상태를 살펴보겠다.

![](/assets/images/tistory/tistory-bc8b2be0d67f/005.png)

위 그림만 보고 바로 name을 찾을 수 있다면 좋지만은 아직 익숙지 않은 분들도 있을 것이다.  
때문에 name 문자열에 해당하는 부분도 따로 살펴보겠다.

![](/assets/images/tistory/tistory-bc8b2be0d67f/006.png)

name에 0x64726857이 들어있는데 이는 'Whrd'를 아스키로 바꾼 값이다.  
   
이제 공격을 해보겠다.  
0x56만큼의 dummy와 변조하고자 하는 문자열을 차례로 입력하는 payload 코드이다.  
 

```
from pwn import *

p = process('./bof')

payload = b'A'*0x56
payload += b'NB_hacker'

p.send(payload)

p.interactive()
```

   
위 코드를 실행하고 나서 Stack을 살펴보겠다.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/007.png)

앞서 본 Stack이랑 값이 다르게 들어있는 것을 볼 수 있다. 0x41은 'A'이다.   
즉, read()에서 우리가 입력한 값(payload)이 들어 있는 것이다.  
   
name 문자열도 확인해 보겠다.

![](/assets/images/tistory/tistory-bc8b2be0d67f/008.png)

위 값은 payload에서 입력한 'NB\_hacker'이다.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/009.png)

박스로 덮인 부분을 살펴보면 정상적으로 문자열이 인자로 전달되는 것을 알 수 있다.  
   
최종 결과를 보면 다음가 같은 모습이 나온다.

![](/assets/images/tistory/tistory-bc8b2be0d67f/010.png)
