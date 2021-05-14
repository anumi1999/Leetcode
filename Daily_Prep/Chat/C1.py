#Google - Onsite
#Question 1: Given a set of words find the longest sequence of words where each previous word is the prefix of the next word and the next word has just one new character 

#Example: 
#[a,ab,abc,abcd,abcdef,abcdefg,abcdefgh,abcdefghi,abcdefghij]

#Two sequences

#a--> ab-->abc-->abcd
#abcdef--->abcdefg--->abcdefgh--->abcdefghi--->abcdefghij


arr = ["a" , "ab" , "abc" , "abcd" , "abcdef" , "abcdefg" , "abcdefgh" , "abcdefghi" , "abcdefghij"] 
pref = arr[0]
cnt = 0
max_cnt = 0
for i in arr:
  if len(i) - 1 > len(pref):
    if cnt > max_cnt:
        max_cnt = cnt
    cnt = 1
  else:
    temp = i[0:len(pref)]
    if temp == pref:
      print(i , end = " ")
      cnt+=1
      print(cnt)
    else:
      if cnt > max_cnt:
        max_cnt = cnt
      cnt = 1
  pref = i
if cnt > max_cnt:
  max_cnt = cnt
print(max_cnt)

