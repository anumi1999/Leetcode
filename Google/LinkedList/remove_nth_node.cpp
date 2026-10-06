#include<bits/stdc++.h>

using namespace std;

struct ListNode{
    int val;
    ListNode* next;
    ListNode(int x): val(x), next(nullptr) {}
};

void removeNthNode(ListNode* head, int k){
    ListNode* n = head;
    ListNode* prev = head;

    while( k > 0 ){
        n = n -> next;
        k--;
    }

    while( n ){
        prev = prev -> next;
        n = n->next;
    }
    prev -> next = prev -> next -> next;
    
}