#include<bits/stdc++.h>

using namespace std;
int main(){
    int n;
    cin >> n;
    vector<int> heights(n);
    for( int i = 0 ; i < n ; i++){
        cin >> heights[i];
    }
    int i = 0, j = n-1;
    int max_area = 0;
    while( i < j ){
        max_area = max(max_area, min(heights[i], heights[j]) * (j-i));
        if( heights[i] < heights[j] ){
            i++;
        }else{
            j--;
        }
    }
    cout << max_area;
    return 0;
}

