// dice.cpp : This file contains the 'main' function. Program execution begins and ends there.
//

#include <iostream>
#include <opencv2/opencv.hpp>
#include <opencv2/highgui.hpp>

using namespace cv;
typedef std::vector<std::vector<Point>> Contours;
typedef std::vector<Vec4i> Hierarchy;
RNG rng(12345);

int thresholdSlider, thresholdSliderMax;
int cannyThreshold1, cannyThreshold1Max;
int cannyRatio = 3; //canny recommended upper:lower ration between 2:1 and 3:1
int blurSize, blurSizeMax;
int diceSize, diceSizeMax;
int method, methodMax;

void on_change(int value, void*) {
	printf("%d\n", value);
}

void mergeOverlappingBoxes(std::vector<Rect> &inputBoxes, Mat &image, std::vector<Rect> &outputBoxes)
{
	Mat mask = Mat::zeros(image.size(), CV_8UC1); // Mask of original image
	Size scaleFactor(2, 2); // To expand rectangles, i.e. increase sensitivity to nearby rectangles. Doesn't have to be (10,10)--can be anything
	for (int i = 0; i < inputBoxes.size(); i++)
	{
		Rect box = inputBoxes[i] + scaleFactor;
		rectangle(mask, box, Scalar(255), CV_FILLED); // Draw filled bounding boxes on mask
	}

	Contours contours;
	// Find contours in mask
	// If bounding boxes overlap, they will be joined by this function call
	findContours(mask, contours, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE);
	for (int j = 0; j < contours.size(); j++)
	{
		outputBoxes.push_back(boundingRect(contours[j]));
	}
}

int main()
{
	VideoCapture cap;
	Mat frame;
	Mat originalFrame;
	Mat example;

	if (!cap.open(0)) return -1;

	cap.set(CAP_PROP_EXPOSURE, -3.0); //this is not supported by all webcams
	//cap.set(CAP_PROP_AUTO_EXPOSURE, 0.25);
	//cap.set(CAP_PROP_FPS, 10.0);

	// Get backgroundFrame
	Mat emptyFrame;
	namedWindow("frame", true);
	namedWindow("originalFrame", true);
	namedWindow("example", true);
	thresholdSlider = 150;
	thresholdSliderMax = 255;
	cannyThreshold1 = 100;
	cannyThreshold1Max = 100;
	blurSize = 3;
	blurSizeMax = 100;
	diceSize = 0;
	diceSizeMax = 3000;
	method = 2;
	methodMax = 2;
	
	// Janik: uncommented the loop because I've manually set the exposure in line 28
	//for (int i = 0; i < 24*3; i++) {
		cap >> emptyFrame;
	//}
	cvtColor(emptyFrame, emptyFrame, CV_BGR2GRAY);
	//for (;;) {
	//	imshow("frame", emptyFrame);
	//	if (waitKey(30) == 27) break;
	//}
	
	createTrackbar("Threshold", "frame", &thresholdSlider, thresholdSliderMax, on_change);
	createTrackbar("Blur", "frame", &blurSize, blurSizeMax, on_change);
	createTrackbar("Canny1", "frame", &cannyThreshold1, cannyThreshold1Max, on_change);
	createTrackbar("DiceSize", "frame", &diceSize, diceSizeMax, on_change);
	createTrackbar("Method", "originalFrame", &method, methodMax, on_change);


	for (;;)
	{	
		cap >> frame;
		originalFrame = frame.clone();
		cvtColor(frame, frame, CV_BGR2GRAY);
		absdiff(frame, emptyFrame, frame);
		//cvtColor(frame, frame, CV_BGR2GRAY);
		//threshold(frame, frame, thresholdSlider, 255, THRESH_BINARY | CV_THRESH_OTSU);
		blur(frame, frame, Size(blurSize, blurSize));
		Canny(frame, frame, cannyThreshold1, cannyThreshold1 * cannyRatio, 3, false);

		Contours diceContours;
		Hierarchy diceHierarchy;
		findContours(frame.clone(), diceContours, diceHierarchy, RETR_CCOMP, CHAIN_APPROX_SIMPLE);

		//iterate over contours
		std::vector<std::vector<Point>> hull(diceContours.size());

		switch (method) {
			case 0:
				for (int i = 0; i < diceContours.size(); i++) {
					double diceContourArea = contourArea(diceContours[i]);

					if (diceContourArea > diceSize) {
						//Rect diceBoundsRect = boundingRect(Mat(diceContours[i]));
						//Mat diceROI = frame(diceBoundsRect);

						//draw bounding rect
						Scalar color = Scalar(0, 153, 255);
						rectangle(originalFrame, boundingRect(diceContours[i]), color, 2);
					}
				}
				break;
			case 1:
				for (size_t i = 0; i < diceContours.size(); i++) {
					convexHull(diceContours[i], hull[i]);
				}

				for (size_t i = 0; i < diceContours.size(); i++) {
					Scalar color = Scalar(rng.uniform(0, 256), rng.uniform(0, 256), rng.uniform(0, 256));
					rectangle(originalFrame, boundingRect(hull[i]), color, 2);
				}

				break;
			case 2:
				std::vector<Rect> inputRect;
				std::vector<Rect> outputRect;

				for (int i = 0; i < diceContours.size(); i++) {
					double diceContourArea = contourArea(diceContours[i]);

					if (diceContourArea > diceSize) {
		
						Scalar color = Scalar(0, 153, 255);
						
						inputRect.push_back(Rect(boundingRect(diceContours[i])));


					}
				}
				mergeOverlappingBoxes(inputRect, originalFrame, outputRect);
				if (outputRect.size() > 0) {
					example = originalFrame(outputRect[0]); 
				}
				for (int i = 0; i < outputRect.size(); i++) {
					rectangle(originalFrame, outputRect[i], Scalar(0,0,255), 2);

				}

				break;

			
		}

		imshow("originalFrame", originalFrame);
		imshow("frame", frame);
		if (example.rows > 0) {
			imshow("example", example);
		}
		if (waitKey(300) == 27) break; // stop capturing by pressing ESC 
	}
	 
	//the camera will be closed automatically upon exit
	return 0;
}